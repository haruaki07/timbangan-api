const express = require("express")
const { default: createConnectionPool, sql } = require("@databases/mysql")
const { z } = require("zod")
const middlewares = require("./middlewares")
const Boom = require("@hapi/boom")
const bcrypt = require("@node-rs/bcrypt")
const jwt = require("jsonwebtoken")

const db = createConnectionPool({
  connectionString:
    process.env.DB_URL || "mysql://root:@localhost:3306/timbangandb",
  onConnectionOpened: () => {
    console.log("Database connected.")
  },
})

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || "awikwok", {
    expiresIn: "7d",
  })
}

const app = express()

app.use(express.json())

const api = express.Router()

api.post("/auth/register", async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().max(100),
        phone_number: z.string().max(20),
        email: z.string().email(),
        password: z.string().min(6),
      })
      .parse(req.body)

    const exist = await db.query(
      sql`SELECT id FROM users WHERE email = ${body.email}`
    )
    if (exist.length > 0) {
      throw new Boom.badRequest("Email is already registered!")
    }

    const user = await db.tx(async (tx) => {
      const hashed = await bcrypt.hash(body.password)

      await tx.query(sql`
        INSERT INTO users (name, email, password, phone_number)
        VALUES (${body.name}, ${body.email}, ${hashed}, ${body.phone_number})
      `)

      const [user] = await tx.query(sql`
        SELECT id, name, email, phone_number, created_at, updated_at 
        FROM users
        WHERE email = ${body.email}
      `)

      return user
    })

    res.json(user)
  } catch (e) {
    next(e)
  }
})

api.post("/auth/login", async (req, res, next) => {
  try {
    const body = z
      .object({
        key: z.string(),
        password: z.string(),
      })
      .parse(req.body)

    const [user] = await db.query(sql`
      SELECT id, password FROM users
      WHERE email = ${body.key} OR phone_number = ${body.key}
      LIMIT 1
    `)
    if (!user) {
      throw new Boom.badRequest("Wrong account and password combination!")
    }

    const valid = await bcrypt.verify(body.password, user.password)
    if (!valid) {
      throw new Boom.badRequest("Wrong account and password combination!")
    }

    return res.json({ token: generateToken({ uid: user.id }) })
  } catch (e) {
    next(e)
  }
})

api.get("/auth/me", middlewares.auth, async (req, res, next) => {
  try {
    const { uid } = req.auth

    const [user] = await db.query(sql`
      SELECT id, name, email, phone_number, created_at, updated_at 
      FROM users
      WHERE id = ${uid}
    `)

    res.json(user)
  } catch (e) {
    next(e)
  }
})

api.post("/profile", middlewares.auth, async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().max(100).optional(),
      })
      .parse(req.body)

    const { uid } = req.auth

    const exist = await db.query(sql`SELECT id FROM users WHERE id = ${uid}`)
    if (exist < 1) {
      throw new Boom.notFound("User not found!")
    }

    const user = await db.tx(async (tx) => {
      const fields = Object.entries(body).map(
        ([k, v]) => sql`${sql.ident(k)} = ${v}`
      )

      if (fields.length > 0) {
        await tx.query(
          sql`UPDATE users SET ${sql.join(fields)} WHERE id = ${uid}`
        )
      }

      const [user] = await tx.query(sql`
        SELECT id, name, email, phone_number, created_at, updated_at 
        FROM users
        WHERE id = ${uid}
      `)

      return user
    })

    res.json(user)
  } catch (e) {
    next(e)
  }
})

api.post("/profile/password", middlewares.auth, async (req, res, next) => {
  try {
    const body = z
      .object({
        password: z.string().min(6),
      })
      .parse(req.body)

    const { uid } = req.auth

    const exist = await db.query(sql`SELECT id FROM users WHERE id = ${uid}`)
    if (exist < 1) {
      throw new Boom.notFound("User not found!")
    }

    const hash = await bcrypt.hash(body.password)

    await db.query(sql`UPDATE users SET password = ${hash} WHERE id = ${uid}`)

    res.sendStatus(204)
  } catch (e) {
    next(e)
  }
})

api.use(middlewares.errorHandler)

app.use("/api/v1", api)

app.listen(process.env.PORT || 3000, () => {
  console.log("Server listening on :3000")
})
