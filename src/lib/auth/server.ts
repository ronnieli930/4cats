// import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [
    admin(),
    organization({
      allowUserToCreateOrganization: async (user) => {
        return true;
      },
    }),
    nextCookies(),
  ],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    // github: {
    //   clientId: process.env.GITHUB_CLIENT_ID as string,
    //   clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    // },
  },
});

export const getSession = async () => {
  return await auth.api.getSession({
    headers: await headers(),
  });
};

export const isLoggedInOrRedirect = async () => {
  const session = await getSession();

  if (!session?.user) {
    redirect("/signin");
  }
  return session;
};

export const NextJsAuthHandler = toNextJsHandler(auth);
