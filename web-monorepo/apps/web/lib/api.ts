// API error responses. Every route answers errors as { error: string } so the app can show them. No "server-only" so node --test can run it.

export const fail = (status: number, error: string, init?: ResponseInit) => Response.json({ error }, { ...init, status });

/** Wraps a route handler so an uncaught error becomes a JSON 500 instead of Next's empty one. The details go to the server log only. */
export const route = <A extends unknown[]>(handler: (...args: A) => Response | Promise<Response>) =>
  async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      console.error(e);
      return fail(500, "Something went wrong on the server. Try again in a moment.");
    }
  };
