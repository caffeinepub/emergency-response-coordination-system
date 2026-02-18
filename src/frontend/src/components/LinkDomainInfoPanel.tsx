import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Info, ExternalLink, AlertCircle } from 'lucide-react';
import { getShareUrl } from '../utils/getShareUrl';

export default function LinkDomainInfoPanel() {
  const [open, setOpen] = useState(false);
  const shareUrl = getShareUrl();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-2">
          <Info className="h-4 w-4" />
          Link & domain
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>App Link & Domain Information</DialogTitle>
          <DialogDescription>
            Learn about your app's shareable link and custom domain setup
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current App Link</CardTitle>
              <CardDescription>
                This is the URL you can share with others to access this app
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-muted p-3">
                <code className="text-sm break-all">{shareUrl}</code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">About Custom Domains</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                The link above is your app's current deployed URL on the Internet Computer network.
                Anyone with this link can access your app and sign in with their own Internet Identity.
              </p>
              <p>
                <strong className="text-foreground">Custom domains</strong> must be configured in your deployment settings
                outside of this application. A custom domain requires:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>A full domain name (e.g., <code>lifelinelinker.icp0.io</code> or <code>lifelinelinker.xyz</code>)</li>
                <li>DNS configuration pointing to your canister</li>
                <li>Deployment platform configuration</li>
              </ul>
              <p className="pt-2">
                <strong className="text-foreground">Note:</strong> A bare name like "lifelinelinker" alone is not a valid domain.
                You need a complete domain with a top-level domain extension (like .com, .xyz, .icp0.io, etc.).
              </p>
              <div className="flex items-center gap-2 pt-2">
                <ExternalLink className="h-4 w-4" />
                <span className="text-xs">Configure custom domains in your deployment platform settings</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                Troubleshooting: Production Publish Failures
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                If a production publish fails with a generic "Deployment error" message, this is usually a temporary issue
                caused by network congestion or the previous build still finalizing on the Internet Computer.
              </p>
              <p className="text-foreground font-medium">
                <strong>Solution:</strong> Wait 30-60 seconds and retry the production publish. It typically succeeds on the second attempt.
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
