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
        child_name: z.string().max(100),
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

      const result = await tx.query(sql`
        INSERT INTO users (name, email, password, phone_number)
        VALUES (${body.name}, ${body.email}, ${hashed}, ${body.phone_number})
      `)

      await tx.query(sql`
        INSERT INTO children (name, parent_id)
        VALUES (${body.child_name}, ${result.insertId})
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
          sql`UPDATE users SET ${sql.join(fields, ",")} WHERE id = ${uid}`
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

api.get("/children", middlewares.auth, async (req, res, next) => {
  try {
    const { uid } = req.auth

    const exist = await db.query(sql`SELECT id FROM users WHERE id = ${uid}`)
    if (exist < 1) {
      throw new Boom.notFound("User not found!")
    }

    const children = await db.query(
      sql`SELECT name, birth_date FROM children WHERE parent_id = ${uid}`
    )

    res.json(children)
  } catch (e) {
    next(e)
  }
})

api.post("/children", middlewares.auth, async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().max(100),
        birth_date: z.string().pipe(z.coerce.date()).optional().default(null),
        birth_place: z.string().optional().default(null),
      })
      .parse(req.body)

    const { uid } = req.auth

    const exist = await db.query(sql`SELECT id FROM users WHERE id = ${uid}`)
    if (exist < 1) {
      throw new Boom.notFound("User not found!")
    }

    const result = await db.query(sql`
      INSERT INTO children (name, birth_date, birth_place, parent_id)
      VALUES (${body.name}, ${body.birth_date}, ${body.birth_place}, ${uid})
    `)

    const [child] = await db.query(sql`
      SELECT id, name, birth_date, birth_place, created_at, updated_at
      FROM children WHERE id = ${result.insertId}
    `)

    res.json(child)
  } catch (e) {
    next(e)
  }
})

api.get("/children/:id", middlewares.auth, async (req, res, next) => {
  try {
    const { uid } = req.auth
    const { id } = req.params

    const [child] = await db.query(
      sql`SELECT * FROM children WHERE id = ${id} AND parent_id = ${uid}`
    )
    if (!child) {
      throw new Boom.notFound("Child not found!")
    }

    const [parent] = await db.query(
      sql`SELECT name FROM users WHERE id = ${child.parent_id}`
    )
    child.parent = parent ?? null

    res.json(child)
  } catch (e) {
    next(e)
  }
})

api.post("/children/:id", middlewares.auth, async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().max(100).optional(),
        birth_date: z.string().pipe(z.coerce.date()).optional(),
        birth_place: z.string().optional(),
        weight: z.number().min(0).optional(),
        length: z.number().min(0).optional(),
        weight_recorded_at: z.string().pipe(z.coerce.date()).optional(),
      })
      .parse(req.body)

    const { uid } = req.auth
    const { id } = req.params

    const exist = await db.query(
      sql`SELECT id FROM children WHERE id = ${id} AND parent_id = ${uid}`
    )
    if (exist < 1) {
      throw new Boom.notFound("Child not found!")
    }

    const child = await db.tx(async (tx) => {
      const fields = Object.entries(body).map(
        ([k, v]) => sql`${sql.ident(k)} = ${v}`
      )

      if (fields.length > 0) {
        await tx.query(
          sql`UPDATE children SET ${sql.join(fields, ",")} WHERE id = ${id}`
        )
      }

      const [child] = await tx.query(
        sql`SELECT * FROM children WHERE id = ${id}`
      )
      return child
    })

    res.json(child)
  } catch (e) {
    next(e)
  }
})

api.delete("/children/:id", middlewares.auth, async (req, res, next) => {
  try {
    const { uid } = req.auth
    const { id } = req.params

    const exist = await db.query(
      sql`SELECT id FROM children WHERE id = ${id} AND parent_id = ${uid}`
    )
    if (exist < 1) {
      throw new Boom.notFound("Child not found!")
    }

    await db.query(sql`DELETE FROM children WHERE id = ${id}`)

    res.sendStatus(204)
  } catch (e) {
    next(e)
  }
})

api.post("/record", async (req, res, next) => {
  try {
    const body = z
      .object({
        box_id: z.string(),
        weight: z.number(),
        length: z.number(),
      })
      .parse(req.body)

    const result = await db.query(sql`
      INSERT INTO weight_records (box_id, weight, length, recorded_at)
      VALUES (${body.box_id}, ${body.weight}, ${body.length}, ${new Date()})
    `)

    res.json({ record_id: result.insertId })
  } catch (e) {
    next(e)
  }
})

api.get('/record_latest', async (req, res, next) => {
  try {
    const box_id = req.query.box_id;

    const [record] = await db.query(sql`
      SELECT * FROM weight_records WHERE box_id = ${box_id} ORDER BY recorded_at DESC LIMIT 1
    `)

    res.json(record)
  } catch (e) {
    next(e)
  }
})

api.post('/record_save', middlewares.auth, async (req, res, next) => {
  try {
    const body = z
      .object({
        record_id: z.number(),
      })
      .parse(req.body)

    const [child] = await db.query(sql`
      SELECT * FROM children WHERE parent_id = ${req.auth.uid}
    `)
    if (!child) {
      throw new Boom.badRequest("Child not found!")
    }

    const [record] = await db.query(sql`
      SELECT * FROM weight_records WHERE id = ${body.record_id}
    `)
    if (!record) {
      throw new Boom.badRequest("Invalid record id!")
    }

    await db.query(sql`
      INSERT INTO records (child_id, box_id, weight, length, recorded_at)
      VALUES (${child.id}, ${record.box_id}, ${record.weight}, ${record.length}, ${new Date()})
    `)

    res.sendStatus(204)
  } catch (e) {
    next(e)
  }
})

api.get('/records', middlewares.auth, async (req, res, next) => {
  try {
    const [child] = await db.query(sql`
      SELECT id FROM children WHERE parent_id = ${req.auth.uid}
    `)
    if (!child) {
      throw new Boom.badRequest("Child not found!")
    }

    const result = await db.query(sql`
      SELECT * FROM records WHERE child_id = ${child.id}
    `)

    res.json(result);
  } catch (e) {
    next(e);
  }
})

api.use(middlewares.errorHandler)

app.use("/api/v1", api)

const port = +process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server listening on :"+port);
})
