
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import type { OrderPayload, Table, TableOrder, Transaction } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    const { db } = getFirebaseAdmin();
    try {
        const payload: OrderPayload = await req.json();
        const { storeId: pujaseraId, customer, cart, paymentMethod } = payload;

        if (!pujaseraId || !customer || !cart || cart.length === 0 || !paymentMethod) {
            return NextResponse.json({ error: 'Data pesanan tidak lengkap.' }, { status: 400 });
        }

        // Queue the entire order for processing by the Cloud Function
        const pujaseraQueueRef = db.collection('Pujaseraqueue').doc();
        await pujaseraQueueRef.set({
            type: 'pujasera-order',
            payload: {
                ...payload,
                isFromCatalog: true
            },
            createdAt: FieldValue.serverTimestamp(),
        });
        
        let responseMessage = '';
        if (paymentMethod === 'kasir') {
            responseMessage = 'Pesanan berhasil dikirim ke masing-masing tenant. Silakan bayar langsung di kasir tenant.';
        } else if (paymentMethod === 'qris') {
            responseMessage = 'Pesanan berhasil dikirim ke masing-masing tenant. Silakan selesaikan pembayaran dengan QRIS yang tersedia.';
        }

        return NextResponse.json({ 
            success: true, 
            message: responseMessage,
        });

    } catch (error) {
        console.error('Error creating catalog order:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
