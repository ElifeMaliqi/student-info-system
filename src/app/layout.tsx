import type { Metadata } from 'next';
import '../index.css';
import { LanguageProvider } from '../context/LanguageContext';
import { UserProvider } from '../context/UserContext';

export const metadata: Metadata = {
  title: 'Future Minds Academy',
  description: 'Student Information System',
  icons: {
    icon: '/logo/favicon.png',
    shortcut: '/logo/favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LanguageProvider>
          <UserProvider>
            {children}
          </UserProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
