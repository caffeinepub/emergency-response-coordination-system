import { Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card/30 py-6">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-muted-foreground">
          © 2025. Built with{' '}
          <Heart className="inline h-4 w-4 fill-emergency-red text-emergency-red" /> using{' '}
          <a
            href="https://caffeine.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:text-emergency-blue transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </footer>
  );
}
