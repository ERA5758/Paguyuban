'use server';

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';

export async function POST(req: NextRequest) {
    const { db } = getFirebaseAdmin();
    try {
        const { storeId, customerId, address } = await req.json();

        if (!storeId || !customerId) {
            return NextResponse.json({ error: 'Data tidak lengkap: storeId dan customerId diperlukan.' }, { status: 400 });
        }
        
        // The address can be an empty string to clear it.
        if (typeof address !== 'string') {
            return NextResponse.json({ error: 'Alamat harus berupa teks.' }, { status: 400 });
        }

        const customerDocRef = db.collection('stores').doc(storeId).collection('customers').doc(customerId);
        
        await customerDocRef.update({
            address: address,
        });

        return NextResponse.json({ success: true, message: 'Alamat pelanggan berhasil diperbarui.' });

    } catch (error) {
        console.error('Error updating customer profile:', error);
        return NextResponse.json({ error: 'Gagal memperbarui profil pelanggan.' }, { status: 500 });
    }
}
