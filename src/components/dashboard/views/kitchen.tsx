
'use client';

import * as React from 'react';
import { useDashboard } from '@/contexts/dashboard-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { CheckCircle, ChefHat, Loader, MessageSquare, Printer, Send, Store } from 'lucide-react';
import { doc, writeBatch, getDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { Badge } from '@/components/ui/badge';
import type { Transaction, TransactionStatus, CartItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type KitchenProps = {
    onFollowUpRequest: (transaction: Transaction) => void;
    onPrintStickerRequest: (transaction: Transaction) => void;
};

// A "slice" of a main pujasera order, intended for a single tenant's kitchen
type TenantOrderSlice = {
    parentTransaction: Transaction;
    tenantStoreId: string;
    tenantStoreName: string;
    items: CartItem[];
    status: 'Diproses' | 'Siap Diambil';
};


export default function Kitchen({ onFollowUpRequest, onPrintStickerRequest }: KitchenProps) {
    const { dashboardData, refreshData } = useDashboard();
    const { activeStore, currentUser } = useAuth();
    const { transactions, tables } = dashboardData;
    const { toast } = useToast();
    const [processingId, setProcessingId] = React.useState<string | null>(null);
    
    const tenantOrderSlices = React.useMemo(() => {
        // Filter for transactions that are still active in the kitchen
        const activeTransactions = transactions.filter(t => t.status === 'Diproses');

        const slices: TenantOrderSlice[] = [];
        
        activeTransactions.forEach(tx => {
            // For a tenant user, only show items belonging to their store
            if (currentUser?.role === 'admin' || currentUser?.role === 'kitchen') {
                const tenantItems = tx.items.filter(item => item.storeId === activeStore?.id);
                if (tenantItems.length > 0) {
                     slices.push({
                        parentTransaction: tx,
                        tenantStoreId: activeStore!.id,
                        tenantStoreName: activeStore!.name,
                        items: tenantItems,
                        status: tx.itemsStatus?.[activeStore!.id] || 'Diproses'
                    });
                }
            }
        });
        
        return slices.sort((a, b) => new Date(a.parentTransaction.createdAt).getTime() - new Date(b.parentTransaction.createdAt).getTime());

    }, [transactions, currentUser, activeStore]);


    const handleReadyAction = async (slice: TenantOrderSlice) => {
        if (!slice.parentTransaction.pujaseraId) {
            toast({ variant: "destructive", title: "Error", description: "Informasi paguyuban tidak ditemukan pada transaksi ini." });
            return;
        }
        
        const processingKey = slice.parentTransaction.id + slice.tenantStoreId;
        setProcessingId(processingKey);

        try {
            const idToken = await auth.currentUser?.getIdToken(true);
            const response = await fetch('/api/kitchen/update-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    tenantId: slice.tenantStoreId,
                    pujaseraId: slice.parentTransaction.pujaseraId,
                    parentTransactionId: slice.parentTransaction.id,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal memperbarui status pesanan.');
            }
            
            toast({ title: 'Status Diperbarui!', description: `Pesanan dari ${slice.tenantStoreName} telah ditandai siap.` });
            refreshData();

        } catch (error) {
            console.error("Error setting order to ready:", error);
            toast({
                variant: "destructive",
                title: "Gagal Memperbarui Status",
                description: (error as Error).message
            });
        } finally {
            setProcessingId(null);
        }
    };
    
    const getStatusBadge = (status: 'Diproses' | 'Siap Diambil') => {
        switch(status) {
            case 'Diproses':
                return <Badge variant="secondary" className='bg-amber-500/20 text-amber-800 border-amber-500/50'>{status}</Badge>;
            case 'Siap Diambil':
                 return <Badge variant="secondary" className='bg-sky-500/20 text-sky-800 border-sky-500/50'>{status}</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    }
    
    const renderOrderCard = (slice: TenantOrderSlice, idx: number) => {
        const { parentTransaction, tenantStoreName, items, status } = slice;
        const tableName = tables.find(t => t.id === parentTransaction.tableId)?.name;
        const uniqueKey = `${parentTransaction.id}-${slice.tenantStoreId}-${idx}`;
        const isProcessing = processingId === parentTransaction.id + slice.tenantStoreId;

        return (
            <Card key={uniqueKey} className="flex flex-col">
                <CardHeader>
                    <div className='flex justify-between items-start'>
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base"><Store className="h-4 w-4"/>{tenantStoreName}</CardTitle>
                            <CardDescription>
                                Nota: {String(parentTransaction.receiptNumber).padStart(6, '0')}
                                {tableName && ` • Meja: ${tableName}`}
                                {' • '}
                                {formatDistanceToNow(new Date(parentTransaction.createdAt), { addSuffix: true, locale: idLocale })}
                            </CardDescription>
                        </div>
                        {getStatusBadge(status)}
                    </div>
                    <CardTitle className="text-lg pt-2">{parentTransaction.customerName}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                     {items.map((item, index) => (
                        <div key={index} className="flex justify-between items-start">
                            <div className="flex-1">
                                <span className="font-semibold">{item.quantity}x</span> {item.productName}
                                {item.notes && (
                                    <p className="text-xs text-muted-foreground italic pl-4">&quot;{item.notes}&quot;</p>
                                )}
                            </div>
                        </div>
                    ))}
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                     <Button 
                        variant="outline"
                        className="w-full" 
                        onClick={() => onPrintStickerRequest(parentTransaction)}
                    >
                        <Printer className="mr-2 h-4 w-4" />
                        Cetak Stiker
                    </Button>
                    <Button 
                        className="w-full" 
                        onClick={() => handleReadyAction(slice)}
                        disabled={isProcessing || status === 'Siap Diambil'}
                    >
                        {isProcessing ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Pesanan Siap
                    </Button>
                </CardFooter>
            </Card>
        )
    };
    
    const ordersDiproses = tenantOrderSlices.filter(s => s.status === 'Diproses');
    const ordersSiapDiambil = tenantOrderSlices.filter(s => s.status === 'Siap Diambil');

    return (
        <Tabs defaultValue="diproses" className="h-[calc(100vh-8rem)] flex flex-col">
            <div className="px-4">
                 <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="diproses">
                        Diproses <Badge variant="secondary" className="ml-2">{ordersDiproses.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="siap_diambil">
                        Siap Diambil <Badge variant="secondary" className="ml-2">{ordersSiapDiambil.length}</Badge>
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="diproses" className="flex-grow">
                <ScrollArea className="h-[calc(100vh-12rem)]">
                    <div className="p-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {ordersDiproses.length > 0 ? (
                           ordersDiproses.map(renderOrderCard)
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center text-center text-muted-foreground h-96">
                                <ChefHat className="w-16 h-16 mb-4" />
                                <h3 className="text-lg font-semibold">Tidak ada pesanan yang sedang diproses.</h3>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </TabsContent>
            <TabsContent value="siap_diambil" className="flex-grow">
                 <ScrollArea className="h-[calc(100vh-12rem)]">
                    <div className="p-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                         {ordersSiapDiambil.length > 0 ? (
                           ordersSiapDiambil.map(renderOrderCard)
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center text-center text-muted-foreground h-96">
                                <ChefHat className="w-16 h-16 mb-4" />
                                <h3 className="text-lg font-semibold">Tidak ada pesanan yang siap diambil.</h3>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </TabsContent>
        </Tabs>
    );
}

