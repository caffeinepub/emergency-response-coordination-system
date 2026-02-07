import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Info, ExternalLink } from 'lucide-react';
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
