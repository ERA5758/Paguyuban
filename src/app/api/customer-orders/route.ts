'use server';

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';

export async function GET(req: NextRequest) {
    const { db } = getFirebaseAdmin();
    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const pujaseraGroupSlug = searchParams.get('pujaseraGroupSlug');

    if (!customerId || !pujaseraGroupSlug) {
        return NextResponse.json({ error: 'Data tidak lengkap: customerId dan pujaseraGroupSlug diperlukan.' }, { status: 400 });
    }

    try {
        // Use a collectionGroup query to find transactions across all tenants in the pujasera
        const transactionsSnapshot = await db.collectionGroup('transactions')
            .where('pujaseraGroupSlug', '==', pujaseraGroupSlug)
            .where('customerId', '==', customerId)
            .orderBy('createdAt', 'desc')
            .limit(20) // Limit to the last 20 transactions for performance
            .get();

        const orders = transactionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json(orders);

    } catch (error) {
        console.error('Error fetching customer orders:', error);
        return NextResponse.json({ error: 'Gagal mengambil riwayat pesanan.' }, { status: 500 });
    }
}
