import './globals.css';
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog';

export const metadata = {
  title: 'Wiki Hub',
  description: 'Local multi-project zread wiki hub'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <GlobalSearchDialog />
      </body>
    </html>
  );
}