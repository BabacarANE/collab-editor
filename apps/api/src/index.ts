import { buildApp } from './app'
import { config } from './config'

const app = buildApp()

app.listen({ port: config.port, host: '0.0.0.0' }).catch(err => {
  app.log.error(err)
  process.exit(1)
})
