import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { isLoggedInOrRedirect } from "@/lib/auth/server";

export default async function ProfilePage() {
  const session = await isLoggedInOrRedirect();

  const { user } = session;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar variant="default" />

      <main className="flex flex-1 flex-col px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight">Profile</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account settings and preferences
            </p>
          </div>

          <div className="space-y-6">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal information and profile picture
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage
                      src={user.image || undefined}
                      alt={user.name}
                    />
                    <AvatarFallback className="text-2xl">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Button variant="outline" disabled>
                      Change Avatar
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Avatar management coming soon
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      defaultValue={user.name}
                      disabled
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      defaultValue={user.email}
                      disabled
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button disabled>Save Changes</Button>
                </div>
              </CardContent>
            </Card>

            {/* Account Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>
                  Manage your account security and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Change Password</div>
                    <div className="text-xs text-muted-foreground">
                      Update your password to keep your account secure
                    </div>
                  </div>
                  <Button variant="outline" disabled>
                    Change Password
                  </Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">
                      Two-Factor Authentication
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Add an extra layer of security to your account
                    </div>
                  </div>
                  <Button variant="outline" disabled>
                    Enable 2FA
                  </Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-destructive">
                      Delete Account
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Permanently delete your account and all data
                    </div>
                  </div>
                  <Button variant="destructive" disabled>
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Session Information */}
            <Card>
              <CardHeader>
                <CardTitle>Session Information</CardTitle>
                <CardDescription>
                  Details about your current session
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-muted-foreground">User ID:</div>
                  <div className="font-mono text-xs">{user.id}</div>

                  <div className="text-muted-foreground">Email Verified:</div>
                  <div>{user.emailVerified ? "Yes" : "No"}</div>

                  <div className="text-muted-foreground">Account Created:</div>
                  <div>
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString()
                      : "N/A"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
