import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by the `requireAuth` preHandler once a bearer token is verified. */
    userId?: string;
  }
}
