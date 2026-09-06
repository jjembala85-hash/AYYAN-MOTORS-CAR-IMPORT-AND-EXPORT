import { createYoga } from "graphql-yoga";
import { db } from "@/server/db";
import { createLoaders, type GraphQLContext } from "@/server/graphql/loaders";
import { schema } from "@/server/graphql/schema";

/*
 * The catalogue is read from Postgres per request, so this route must never be
 * collapsed into the static build.
 */
export const dynamic = "force-dynamic";

const yoga = createYoga<object, GraphQLContext>({
  schema,
  graphqlEndpoint: "/api/graphql",

  // Fresh loaders per request. Sharing them would leak one caller's view of the
  // catalogue into the next request served by the same instance. The return type
  // is annotated so Yoga infers exactly the context the schema was built with.
  context: (): GraphQLContext => ({ db, loaders: createLoaders(db) }),

  // The explorer is a development affordance; opt in explicitly for production.
  graphiql: process.env.NODE_ENV !== "production" || process.env.ENABLE_GRAPHIQL === "1",

  // Next supplies the Response/Request globals; handing them to Yoga keeps it
  // from reaching for a Node-only implementation.
  fetchAPI: { Response, Request },
});

/*
 * Thin wrappers rather than re-exporting `handleRequest` directly: Yoga's
 * handler takes a server context as its second argument, which is not the
 * `{ params }` object Next hands a route handler.
 *
 * GET is served as well as POST so a simple query can be sent as a URL — a GET
 * response is cacheable by a CDN and the browser, which a POST is not. That is
 * the main lever available for the high-latency export markets this serves.
 */
export async function GET(request: Request): Promise<Response> {
  return yoga.handleRequest(request, {});
}

export async function POST(request: Request): Promise<Response> {
  return yoga.handleRequest(request, {});
}

export async function OPTIONS(request: Request): Promise<Response> {
  return yoga.handleRequest(request, {});
}
