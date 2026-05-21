import type { Metadata } from 'next';
import '../index.css';
import { LanguageProvider } from '../context/LanguageContext';
import { UserProvider } from '../context/UserContext';

export const metadata: Metadata = {
  title: 'Future Minds Academy',
  description: 'Student Information System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <UserProvider>
            {children}
          </UserProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
