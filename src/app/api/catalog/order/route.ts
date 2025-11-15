
'use server';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import type { OrderPayload } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    const { db } = getFirebaseAdmin();
    try {
        const payload: OrderPayload = await req.json();
        const { storeId: pujaseraId, customer, cart, paymentMethod, deliveryOption, deliveryAddress } = payload;

        if (!pujaseraId || !customer || !cart || cart.length === 0 || !paymentMethod || !deliveryOption) {
            return NextResponse.json({ error: 'Data pesanan tidak lengkap.' }, { status: 400 });
        }
        
        if (deliveryOption === 'delivery' && !deliveryAddress) {
            return NextResponse.json({ error: 'Alamat pengiriman diperlukan untuk opsi pengiriman.' }, { status: 400 });
        }

        // Use the new queue for individual tenant processing
        const individualQueueRef = db.collection('PujaseraIndividualQueue').doc();
        await individualQueueRef.set({
            type: 'pujasera-order-individual',
            payload: {
                ...payload,
                isFromCatalog: true
            },
            createdAt: FieldValue.serverTimestamp(),
        });
        
        let responseMessage = 'Pesanan Anda telah berhasil dikirim ke masing-masing tenant.';

        return NextResponse.json({ 
            success: true, 
            message: responseMessage,
        });

    } catch (error) {
        console.error('Error creating individual catalog order:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
