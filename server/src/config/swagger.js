import swaggerJSDoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Financial Dashboard API',
      version: '1.0.0',
    },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        bearerAuth: {type: 'http', scheme: 'bearer', bearerFormat: 'JWT'}
      }
    },
    security: [{ bearerAuth: []}]
  },
  apis: ['./src/modules/**/*.routes.js']
};
export const swaggerSpecification = swaggerJSDoc(options);
