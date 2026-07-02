import { Route } from "./index.ts";
import { RouterContext } from "../deps.ts";
import { isAuthenticated, isAdmin } from "../middleware/authMiddleware.ts";

// User routes handlers
const getUsers = async (ctx: RouterContext<any, any, any>) => {
  ctx.response.body = { message: "Get all users endpoint" };
};

const getUserById = async (ctx: RouterContext<any, any, any>) => {
  const id = ctx.params.id;
  ctx.response.body = { message: `Get user with ID: ${id}` };
};

const createUser = async (ctx: RouterContext<any, any, any>) => {
  const bodyParser = await ctx.request.body({type: "json"});
  const body = await bodyParser.value;
  ctx.response.body = { message: "User created successfully", data: body };
};

const updateUser = async (ctx: RouterContext<any, any, any>) => {
  const id = ctx.params.id;
  const bodyParser = await ctx.request.body({type: "json"});
  const body = await bodyParser.value;
  ctx.response.body = { message: `User ${id} updated successfully`, data: body };
};

const deleteUser = async (ctx: RouterContext<any, any, any>) => {
  const id = ctx.params.id;
  ctx.response.body = { message: `User ${id} deleted successfully` };
};

// Export an array of routes
// User management is admin-only
export const userRoutes: Route[] = [
  { method: "GET", path: "/users", handler: getUsers, middleware: [isAuthenticated, isAdmin] },
  { method: "GET", path: "/users/:id", handler: getUserById, middleware: [isAuthenticated, isAdmin] },
  { method: "POST", path: "/users", handler: createUser, middleware: [isAuthenticated, isAdmin] },
  { method: "PUT", path: "/users/:id", handler: updateUser, middleware: [isAuthenticated, isAdmin] },
  { method: "DELETE", path: "/users/:id", handler: deleteUser, middleware: [isAuthenticated, isAdmin] },
];
