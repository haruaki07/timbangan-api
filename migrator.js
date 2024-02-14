const fs = require("node:fs")
const { dirname, basename, join } = require("node:path")
const { Umzug } = require("umzug")
const { default: createConnectionPool, sql } = require("@databases/mysql")

const getDBConnection = () => {
  const db = createConnectionPool({
    poolSize: 1,
    connectionString:
      process.env.DB_URL || "mysql://root:@localhost:3306/timbangandb",
  })

  return db
}

const umzug = new Umzug({
  context: getDBConnection(),
  migrations: {
    glob: ["migrations/*.sql", { cwd: __dirname }],
    resolve: ({ name, path, context: db }) => {
      const downPath = join(dirname(path), "down", basename(path))

      return {
        name,
        path,
        up: async () => db.query(sql.file(path)),
        down: async () => db.query(sql.file(downPath)),
      }
    },
  },
  storage: {
    async executed({ context: db }) {
      await db.query(sql`create table if not exists migrations(name text)`)
      const migrations = await db.query(sql`select name from migrations`)
      return migrations.map((r) => r.name)
    },
    async logMigration({ name, context: db }) {
      await db.query(sql`insert into migrations(name) values (${name})`)
    },
    async unlogMigration({ name, context: db }) {
      await db.query(sql`delete from migrations where name = ${name}`)
    },
  },
  logger: console,
  create: {
    folder: "migrations",
  },
})

exports.umzug = umzug

if (require.main === module) {
  umzug.on("afterCommand", ({ context: db }) => {
    db.dispose().catch((e) => console.error(e))
  })

  umzug.runAsCLI()
}
