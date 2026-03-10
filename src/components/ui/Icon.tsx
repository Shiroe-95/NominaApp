import { LucideProps } from 'lucide-react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { memo } from 'react';

interface IconProps extends Omit<LucideProps, 'ref'> {
    name: keyof typeof dynamicIconImports;
}

const iconComponents = Object.entries(dynamicIconImports).reduce((acc, [iconName, iconLoader]) => {
    acc[iconName as keyof typeof dynamicIconImports] = dynamic(iconLoader, {
        loading: () => <div style={{ width: 24, height: 24 }} />
    }) as ComponentType<LucideProps>;
    return acc;
}, {} as Record<keyof typeof dynamicIconImports, ComponentType<LucideProps>>);

const Icon = memo(({ name, ...props }: IconProps) => {
    const LucideIcon = iconComponents[name];

    return <LucideIcon {...props} />;
});

Icon.displayName = 'Icon';

export default Icon;
