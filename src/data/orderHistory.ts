// Order History Data
export const MY_ORDERS = [
    {
        id: "ord_123",
        dealName: "Tata Salt (1kg x 50)",
        date: "24 Jan 2024",
        quantity: 2, // units
        totalWeight: "100kg",
        amount: 2200,
        savings: 600,
        status: "Delivered",
        qrCode: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ORDER_ORD123_VERIFIED"
    },
    {
        id: "ord_124",
        dealName: "Madhur Sugar (Bulk)",
        date: "Today, 10:30 AM",
        quantity: 3,
        totalWeight: "150kg",
        amount: 5550,
        savings: 1050,
        status: "Processing", // Deal just unlocked
        qrCode: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ORDER_ORD124_PROCESSING"
    },
    {
        id: "ord_125",
        dealName: "Fortune Oil (15L)",
        date: "22 Jan 2024",
        quantity: 1,
        totalWeight: "15kg",
        amount: 2100,
        savings: 500,
        status: "Delivered",
        qrCode: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ORDER_ORD125_VERIFIED"
    }
];

export type Order = typeof MY_ORDERS[0];
