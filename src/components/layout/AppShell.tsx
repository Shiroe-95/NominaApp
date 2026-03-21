'use client';

import { ReactNode } from 'react';
import { usePathname } from '@/i18n/routing';
import Sidebar from './Sidebar';
import Header from './Header';
import AiSidebar from '@/components/ui/AiSidebar';

interface AppShellProps {
    children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';
    const isPublicPage = pathname === '/' || pathname === '/pricing' || pathname === '/contact';

    if (isLoginPage || isPublicPage) {
        return <>{children}</>;
    }

    return (
        <div className="relative flex h-screen overflow-hidden bg-transparent">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute right-[-120px] top-[-140px] h-96 w-96 rounded-full bg-violet/20 blur-[100px] animate-pulse-glow" />
                <div className="absolute bottom-[-140px] left-[20%] h-96 w-96 rounded-full bg-cyan/15 blur-[120px]" />
                <div className="absolute top-[40%] right-[30%] h-64 w-64 rounded-full bg-emerald/10 blur-[90px]" />
            </div>
            {/* Sidebar */}
            <div className="relative hidden flex-shrink-0 md:flex md:w-72 md:flex-col">
                <Sidebar />
            </div>

            {/* Main Content */}
            <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
                <Header />

                <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-24">
                    <div className="mx-auto max-w-7xl">
                        {children}
                    </div>
                </main>

                <AiSidebar />
            </div>
        </div>
    );
}
