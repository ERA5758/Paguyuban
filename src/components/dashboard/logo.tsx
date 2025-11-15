
import React from 'react';
import { Store } from 'lucide-react';


type LogoProps = {
    storeName?: string;
}

export function Logo({ storeName }: LogoProps) {
  return (
    <div className="flex items-center gap-2 text-primary">
      <div className="flex items-center justify-center rounded-md bg-primary/20 p-2">
        <Store className="h-6 w-6 text-primary" />
      </div>
      <div className="flex flex-col group-data-[collapsible=icon]:hidden">
        <span className="font-headline text-xl leading-none tracking-wider text-sidebar-foreground">PAGUYUBAN UMKM</span>
        {storeName && (
            <span className="text-xs font-medium text-sidebar-foreground/70">{storeName}</span>
        )}
      </div>
    </div>
  );
}
