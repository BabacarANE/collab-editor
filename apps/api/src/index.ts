import { buildApp } from './app'
import { config } from './lib/config'

const app = buildApp()

const start = async () => {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
