import { useEffect, useState, useRef } from 'react';
import { ShoppingBag, MapPin } from 'lucide-react';
import GroupBuyCard from '../../components/GroupBuyCard';
import HostDealModal from '../../components/HostDealModal';
import DigitalPassModal from '../../components/DigitalPassModal';
import { groupBuyApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import type { Deal } from '../../db/db';

export default function GroupBuyPage() {
    const [activeDeals, setActiveDeals] = useState<Deal[]>([]);
    const { addToast } = useToast();
    const { user } = useAuth();
    const [isHostModalOpen, setIsHostModalOpen] = useState(false);
    const [view, setView] = useState<'active' | 'history'>('active');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Location-based filtering states
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
    const locationToastShown = useRef(false);
    const [searchRadius, setSearchRadius] = useState(5); // km

    useEffect(() => {
        requestLocation();
        loadDeals();
    }, []);

    // Request user's location
    const requestLocation = () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    setLocationPermissionDenied(false);

                    // Fetch and show address
                    fetchAddress(position.coords.latitude, position.coords.longitude).then(addr => {
                        if (addr && !locationToastShown.current) {
                            locationToastShown.current = true;
                            addToast(`📍 Location: ${addr}`, "success", 4000);
                        }
                    });
                },
                (error) => {
                    console.warn('Location permission denied:', error);
                    setLocationPermissionDenied(true);
                    addToast('📍 Location access denied. Showing all deals.', 'info');
                }
            );
        } else {
            console.warn('Geolocation not supported');
            addToast('Location not supported by browser', 'warning');
        }
    };

    // Haversine Distance Helper (km)
    function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }

    function deg2rad(deg: number) {
        return deg * (Math.PI / 180);
    }

    // OpenStreetMap Reverse Geocoding
    async function fetchAddress(lat: number, lng: number) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await response.json();
            // Return a concise address
            const addr = data.address;
            const shortAddr = [addr.road || addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.county].filter(Boolean).join(', ');
            return shortAddr || data.display_name.split(',')[0];
        } catch (error) {
            console.error("OSM Geocoding Error:", error);
            return null;
        }
    }

    async function loadDeals() {
        setLoading(true);
        try {
            const response = await groupBuyApi.getAll();
            setActiveDeals(response.data);
        } catch (e: any) {
            console.error("Failed to load deals", e);
            addToast('Failed to load deals', 'error');
        } finally {
            setLoading(false);
        }
    }

    const handleNewDeal = async (newDeal: any) => {
        try {
            // @ts-ignore - Accessing potentially un-typed _id or id
            const shopkeeperId = user?._id || user?.id;

            if (!shopkeeperId) {
                addToast("You must be logged in to host a deal", "error");
                return;
            }

            // Prepare payload
            const dealPayload: any = {
                shopkeeperId: shopkeeperId,
                groupName: newDeal.groupName, // Use the proper name
                products: newDeal.products,
                totalAmount: newDeal.totalAmount,
                marketPrice: newDeal.marketPrice,
                dealPrice: newDeal.dealPrice,
                targetUnits: newDeal.targetUnits,
                currentUnits: 0,
                category: newDeal.category,
                image_url: newDeal.image_url,
                aiInsight: "Host-Optimized Deal",
                tiers: [
                    { goal: Math.round(newDeal.targetUnits * 0.1), price: Math.round(newDeal.marketPrice * 0.95), label: 'Silver' },
                    { goal: Math.round(newDeal.targetUnits * 0.5), price: Math.round(newDeal.marketPrice * 0.90), label: 'Gold' },
                    { goal: newDeal.targetUnits, price: newDeal.dealPrice, label: 'Platinum' }
                ],
                status: 'active',
                expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 Minutes from now
            };

            // Attach Location & Address (using OSM)
            // UPDATED: Use GeoJSON format
            if (userLocation) {
                dealPayload.location = {
                    type: 'Point',
                    coordinates: [userLocation.lng, userLocation.lat] // [Longitude, Latitude]
                };

                // Fetch Readable Address from OpenStreetMap
                const nearbyAddress = await fetchAddress(userLocation.lat, userLocation.lng);
                if (nearbyAddress) {
                    dealPayload.anchorShop = nearbyAddress;
                    addToast(`📍 Location tagged: ${nearbyAddress}`, "success");
                }
            }

            console.log("Submitting payload:", dealPayload);
            await groupBuyApi.create(dealPayload);
            addToast("🎉 Deal Launched Successfully!", "success");
            loadDeals();
            setIsHostModalOpen(false);
        } catch (e: any) {
            console.error("Error creating deal", e);
            const errorMsg = e.response?.data?.message || e.message || "Unknown error";
            addToast(`Failed to launch deal: ${errorMsg}`, "error");
        }
    };

    // Filter Logic
    const nearbyDeals = activeDeals.filter(d => {
        if (d.status !== 'active') return false;

        // Handle GeoJSON Location Check
        // d.location should be { type: 'Point', coordinates: [lng, lat] }
        if (d.location && (d.location as any).coordinates && userLocation) {
            const [dealLng, dealLat] = (d.location as any).coordinates;
            // Note: If dealLat/Lng are missing/invalid, skip filtering or show?
            if (typeof dealLat === 'number' && typeof dealLng === 'number') {
                const dist = calculateDistance(userLocation.lat, userLocation.lng, dealLat, dealLng);
                return dist <= searchRadius;
            }
        }

        // Fallback for legacy deals with { lat, lng } vs GeoJSON or no location
        // If we strictly want to hide non-located deals when location is enabled:
        // return false; 

        // But for dev, let's keep showing them if they have NO location data, so we don't see empty screen.
        // If deal has explicit location data (GeoJSON) and we filtered it out above, it returns false.
        // If it falls through here, it means it didn't have location data.
        return true;
    });

    return (
        <div className="min-h-screen bg-[#F3F4F6] dark:bg-gray-900 relative p-4 pb-48">
            {/* BACKGROUND MESH */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
                    style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                </div>
            </div>

            {/* HEADER SECTION */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 sticky top-0 z-50 rounded-2xl mb-6 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-black">
                            <ShoppingBag size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Live GroupBuy</h1>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-gray-500 font-medium">Bulk Shop Orders</p>
                                {userLocation && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-1"><MapPin size={8} /> Nearby</span>}
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setIsHostModalOpen(true)} className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-xs font-bold shadow-lg">
                        + Host New Deal
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <main className="max-w-4xl mx-auto">
                {/* Location Status & Radius Selector */}
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        {userLocation ? (
                            <>
                                <span className="text-green-600 dark:text-green-500 font-bold text-sm flex items-center gap-1">
                                    📍 Location Enabled
                                </span>
                                <span className="text-xs text-gray-500">• Showing nearby deals</span>
                            </>
                        ) : locationPermissionDenied ? (
                            <>
                                <span className="text-orange-600 dark:text-orange-500 font-bold text-sm">📍 Location Disabled</span>
                                <button onClick={requestLocation} className="text-xs text-blue-600 hover:underline ml-2">Enable</button>
                            </>
                        ) : (
                            <span className="text-gray-500 text-sm">📍 Requesting location...</span>
                        )}
                    </div>

                    {userLocation && (
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Radius:</label>
                            <select
                                value={searchRadius}
                                onChange={(e) => setSearchRadius(Number(e.target.value))}
                                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium text-sm"
                            >
                                <option value={2}>2 km</option>
                                <option value={5}>5 km</option>
                                <option value={10}>10 km</option>
                                <option value={20}>20 km</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="mb-6 flex gap-4 border-b">
                    <button onClick={() => setView('active')} className={`pb-3 px-2 text-sm font-bold ${view === 'active' ? 'text-black border-b-2 border-black' : 'text-gray-400'}`}>Live Deals</button>
                    <button onClick={() => setView('history')} className={`pb-3 px-2 text-sm font-bold ${view === 'history' ? 'text-black border-b-2 border-black' : 'text-gray-400'}`}>My Deals</button>
                </div>

                {view === 'active' ? (
                    <div className="space-y-6 min-h-[50vh]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                                <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
                                <p className="font-bold text-xs uppercase tracking-widest">Finding best prices...</p>
                            </div>
                        ) : nearbyDeals.length > 0 ? (
                            nearbyDeals.map((deal) => (
                                <GroupBuyCard
                                    key={deal._id}
                                    deal={deal}
                                    customerId={(user as any)?._id || (user as any)?.id || 'shop_me'}
                                    onShowPass={setSelectedOrder}
                                    onJoinSuccess={async () => {
                                        await loadDeals();
                                        setView('history');
                                    }}
                                />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in opacity-50">
                                <ShoppingBag size={40} className="text-gray-300 dark:text-gray-600 mb-2" />
                                <p className="text-gray-400 text-sm">No nearby deals found.</p>
                                {userLocation && <p className="text-xs text-gray-400 mt-2">Searched within {searchRadius}km of your location.</p>}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in pb-10">
                        {/* HELPER: Filter My Deals */}
                        {(() => {
                            const myId = (user as any)?._id || (user as any)?.id || 'shop_me';
                            const myDeals = activeDeals.filter(d => d.members?.includes(myId));

                            const liveDeals = myDeals.filter(d => d.status === 'active');
                            const completedDeals = myDeals.filter(d => d.status === 'completed');

                            // Real expired deals + 2 Dummy Examples as requested
                            const expiredDeals = [
                                ...myDeals.filter(d => d.status === 'expired'),
                                { _id: 'ex_demo_1', groupName: 'Amul Butter 500g (Stock Out)', status: 'expired' },
                                { _id: 'ex_demo_2', groupName: 'Coca Cola Pet Bottles (Batch Ended)', status: 'expired' }
                            ];

                            if (myDeals.length === 0 && expiredDeals.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                                        <ShoppingBag size={40} className="text-gray-300 mb-2" />
                                        <p className="text-gray-400 font-bold">You haven't joined any deals yet.</p>
                                    </div>
                                );
                            }

                            return (
                                <>
                                    {/* 1. COMPLETED / CONFIRMED DEALS */}
                                    {completedDeals.length > 0 && (
                                        <section>
                                            <h3 className="text-xs font-black text-green-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                Ready for Pickup (Confirmed)
                                            </h3>
                                            <div className="space-y-4">
                                                {completedDeals.map(deal => (
                                                    <div key={deal._id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-green-200 dark:border-green-900 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">COMPLETED</div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden">
                                                                <img src={(deal as any).image_url || '/placeholder.png'} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-gray-900 dark:text-white text-lg">{deal.groupName}</h4>
                                                                <p className="text-xs text-gray-500">Target Reached! Truck arriving soon.</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => setSelectedOrder({
                                                                id: deal._id,
                                                                dealName: deal.groupName,
                                                                status: 'Confirmed',
                                                                qrCode: `ORDER_${deal._id}`
                                                            })}
                                                            className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-green-200 active:scale-95 transition-all"
                                                        >
                                                            View Digital Pass
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {/* 2. LIVE / PROCESSING DEALS */}
                                    {liveDeals.length > 0 && (
                                        <section>
                                            <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 mt-2">
                                                Active Orders (In Progress)
                                            </h3>
                                            <div className="grid gap-4">
                                                {liveDeals.map(deal => (
                                                    <GroupBuyCard
                                                        key={deal._id}
                                                        deal={deal}
                                                        customerId={myId}
                                                        onShowPass={setSelectedOrder}
                                                    />
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {/* 3. EXPIRED / FAILED DEALS */}
                                    {expiredDeals.length > 0 && (
                                        <section>
                                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 mt-2">
                                                Expired / Past
                                            </h3>
                                            <div className="space-y-3 opacity-60 grayscale hover:grayscale-0 transition-all">
                                                {expiredDeals.map(deal => (
                                                    <div key={deal._id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-gray-200 p-2 rounded-lg"><ShoppingBag size={16} className="text-gray-500" /></div>
                                                            <span className="font-bold text-gray-600 dark:text-gray-400">{deal.groupName}</span>
                                                        </div>
                                                        <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded">Expired</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}

                <HostDealModal isOpen={isHostModalOpen} onClose={() => setIsHostModalOpen(false)} onHost={handleNewDeal} />
                <DigitalPassModal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} order={selectedOrder} />
            </main>
        </div>
    );
}
