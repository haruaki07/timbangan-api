const { Boom } = require("@hapi/boom")
const { expressjwt } = require("express-jwt")
const { ZodError } = require("zod")

function errorHandler(err, _req, res, next) {
  if (!(err instanceof Error)) return next(err)

  console.error(err)

  const body = {
    statusCode: err.status ?? err.statusCode ?? 500,
    message: err.message,
    error: err.name,
  }

  if (err instanceof Boom) {
    body.statusCode = err.output.payload.statusCode
    body.message = err.output.payload.message
    body.error = err.output.payload.error
  }

  if (err instanceof ZodError) {
    body.statusCode = 400
    body.error = "Bad Request"
    body.validation = err.format()
    body.message = "Invalid request body"
  }

  if (body.statusCode >= 500) {
    body.message = "An error occurred! Please try again later."
    body.error = "Internal Server Error"
  }

  if (process.env.NODE_ENV === "development") {
    body.stack = err.stack
  }

  res.status(body.statusCode).json(body)
}

const auth = expressjwt({
  secret: process.env.JWT_SECRET || "awikwok",
  algorithms: ["HS256"],
})

module.exports = {
  errorHandler,
  auth,
}
