import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';

type Language = 'en' | 'hi' | 'te';

const staticTranslations = {
    en: {
        'Billing': 'Billing',
        'Customers': 'Customers',
        'Products': 'Products',
        'Udhaar': 'Udhaar',
        'Stock': 'Stock',
        'Payments': 'Payments',
        'Analytics': 'Analytics',
        'toggleTitle': 'Toggle Language',
        'tapToAdd': 'Billing',
        'viewCart': 'View Cart',
        'Menu': 'Menu',
        'Sign Out': 'Sign Out',
        'Ready to leave?': 'Ready to leave?',
        'Log out from': 'Log out from',
        'Sign Out Now': 'Sign Out Now',
        'Stay Logged In': 'Stay Logged In',
        'Records': 'Records',
        'Group Buy': 'Group Buy',
        'Expiry & Waste': 'Expiry & Waste',
        'GST & ITR': 'GST & ITR',
        'WhatsApp Desk': 'WhatsApp Desk',
        'Recovery Agent': 'Recovery Agent',
        'Order Summary': 'Order Summary',
        'Identify Customer': 'Identify Customer',
        'Select Payment': 'Select Payment',
        'Proceed': 'Proceed',
        'Items': 'Items',
        'Select Customer': 'Select Customer',
        'Search by name or phone': 'Search by name or phone',
        'Register New Customer': 'Register New Customer',
        'New Customer': 'New Customer',
        'Save & Pay': 'Save & Pay',
        'Udhaar Score': 'Udhaar Score',
        'Available Credit': 'Available Credit',
        'Select Payment Method': 'Select Payment Method',
        'Cash': 'Cash',
        'Pay with physical currency': 'Pay with physical currency',
        'UPI / Online': 'UPI / Online',
        'PhonePe, GPay, Paytm': 'PhonePe, GPay, Paytm',
        'Udhaar (Credit)': 'Udhaar (Credit)',
        'Limit Exceeded': 'Limit Exceeded',
        'Total Amount': 'Total Amount',
        'Success!': 'Success!',
        'Payment Received': 'Payment Received',
        'Total Amount Paid': 'Total Amount Paid',
        'Download PDF': 'Download PDF',
        'Share PDF': 'Share PDF',
        'Send WhatsApp': 'Send WhatsApp',
        'OK, NEXT BILL': 'OK, NEXT BILL',
        'Cancel': 'Cancel',
        'Verifying...': 'Verifying...',
        'Collect': 'Collect',
        'Pay': 'Pay',
        'via UPI': 'via UPI',
        'Add': 'Add',
        'to Udhaar': 'to Udhaar',
        "OTP sent to customer's WhatsApp": "OTP sent to customer's WhatsApp",
        'Enter 6-Digit Code': 'Enter 6-Digit Code',
        'Confirm & Complete': 'Confirm & Complete',
        'Verifying UPI...': 'Verifying UPI...',
        'Processing Cash...': 'Processing Cash...',
        'Customer Verification': 'Customer Verification',
        'Sending verification code...': 'Sending verification code...',
        'Unnamed Customer': 'Unnamed Customer',
        'GLOBAL': 'GLOBAL',
        'Searching globally...': 'Searching globally...',
        'No results found for': 'No results found for',
        'Add to your shop network': 'Add to your shop network',
        'Back': 'Back',
        'available': 'available',
        'Pay on credit': 'Pay on credit',
        'Dues': 'Dues',
        'Searching...': 'Searching...',
        'Reset Filters': 'Reset Filters',
        'Add Product': 'Add Product',
        'Scan Barcode': 'Scan Barcode',
        'Categories': 'Categories',
        'All Categories': 'All Categories',
        'Low Stock': 'Low Stock',
        'Out of Stock': 'Out of Stock',
        'Available': 'Available',
        'Update Quantity': 'Update Quantity',
        'Increase': 'Increase',
        'Decrease': 'Decrease',
        'Remove': 'Remove',
        'Clear All': 'Clear All',
        'Cart cleared': 'Cart cleared',
        'Only': 'Only',
        'Search products...': 'Search products...',
        'Scan': 'Scan',
        'Filter': 'Filter',
        'All': 'All',
        'Out': 'Out',
        'Low': 'Low',
        'Checkout': 'Checkout',
        'Scan product barcode': 'Scan product barcode',
        'Full Name': 'Full Name',
        'Phone Number': 'Phone Number',
        'e.g. Rahul Sharma': 'e.g. Rahul Sharma',
        '10-digit mobile': '10-अंकों का मोबाइल',
        'Are you sure you want to clear the entire cart?': 'Are you sure you want to clear the entire cart?',
        'Credit Limit Exceeded!': 'Credit Limit Exceeded!',
        'Enter valid 10-digit phone number': 'Enter valid 10-digit phone number',
        'New customer created': 'New customer created',
        'Customer identified': 'Customer identified',
        'Transaction successful!': 'Transaction successful!',
        'UPI Payment Successful!': 'UPI Payment Successful!',
        'Verification code sent to customer': 'Verification code sent to customer',
        'Failed to send OTP': 'Failed to send OTP',
        'Udhaar Verified & Transaction Complete!': 'Udhaar Verified & Transaction Complete!',
        'Invoice Downloaded': 'Invoice Downloaded',
        'Invoice Shared Successfully': 'Invoice Shared Successfully',
        'Bill sent to customer on WhatsApp': 'Bill sent to customer on WhatsApp',
        'left': 'left',
        'ADD': 'ADD',
        'Sold Out': 'Sold Out',
        'OUT OF STOCK': 'OUT OF STOCK',
        'Type name or 10-digit phone...': 'Type name or 10-digit phone...',
        'Select a payment method': 'Select a payment method',
        'Retail Invoice': 'Retail Invoice',
        'Date': 'Date',
        'Customer': 'Customer',
        'Walk-in Customer': 'Walk-in Customer',
        'Item': 'Item',
        'Qty': 'Qty',
        'Rate': 'Rate',
        'Amount': 'Amount',
        'Grand Total': 'Grand Total',
        'Thank you for shopping!': 'Thank you for shopping!',
        'Powered by': 'Powered by',
        'Shop Invoice': 'Shop Invoice',
        'Here is your invoice for': 'Here is your invoice for',
        'Dashboard': 'Dashboard',
        'Last 30 Days': 'Last 30 Days',
        'Total Revenue': 'Total Revenue',
        'Total Orders': 'Total Orders',
        'across all channels': 'across all channels',
        'Avg. Order Value': 'Avg. Order Value',
        'per customer': 'per customer',
        'Revenue Trend': 'Revenue Trend',
        'Revenue': 'Revenue',
        'No revenue data available': 'No revenue data available',
        'Payment Distribution': 'Payment Distribution',
        'No payment data': 'No payment data',
        'Product Sales Share': 'Product Sales Share',
        'No product data': 'No product data',
        'Top Selling Products': 'Top Selling Products',
        'Top Customers': 'Top Customers',
        'No customer data yet': 'No customer data yet',
        'orders': 'orders',
        'Add Item': 'Add Item',
        'Price': 'Price',
        'Add 20+ starter items to your inventory?': 'Add 20+ starter items to your inventory?',
        'Inventory filled!': 'Inventory filled!',
        'Failed to seed': 'Failed to seed',
        'Active Udhaar': 'Active Udhaar',
        'Pending dues management': 'Pending dues management',
        'Active Debtors': 'Active Debtors',
        'Search debtors...': 'Search debtors...',
        'No pending udhaar found!': 'No pending udhaar found!',
        'Due Amount': 'Due Amount',
        'Settle Dues': 'Settle Dues',
        'Credit Health': 'Credit Health',
        'Why this score for': 'Why this score for',
        'Current Rating': 'Current Rating',
        'Credit Limit': 'Credit Limit',
        'Based strictly on behavior logic.': 'Based strictly on behavior logic.',
        'Logic Reasons': 'Logic Reasons',
        'GOT IT': 'GOT IT',
        'Record Payment': 'Record Payment',
        'Amount to Settle': 'Amount to Settle',
        'Total Dues': 'Total Dues',
        'Payment Mode': 'Payment Mode',
        'UPI / ONLINE': 'UPI / ONLINE',
        'Due Balance': 'Due Balance',
        'Activity Log': 'Activity Log',
        'SETTLE DUES': 'SETTLE DUES',
        'Udhaar Debt': 'Udhaar Debt',
        'Settlements': 'Settlements',
        'Instant Paid': 'Instant Paid',
        'Total Outstanding': 'Total Outstanding',
        'Success': 'Success',
        'Avg. Days': 'Avg. Days',
        'Pending': 'Pending',
        'Follow-ups': 'Follow-ups',
        'AI Voice Control': 'AI Voice Control',
        'Automated recovery for': 'Automated recovery for',
        'All Clear': 'All Clear',
        'No actions required': 'No actions required',
        'RECOVER': 'RECOVER',
        'HIGH': 'HIGH',
        'MEDIUM': 'MEDIUM',
        'LOW': 'LOW',
    },
    hi: {
        'Billing': 'बिलिंग',
        'Customers': 'ग्राहक',
        'Products': 'उत्पाद',
        'Udhaar': 'उधार',
        'Stock': 'स्टॉक',
        'Payments': 'भुगतान',
        'Analytics': 'एनालिटिक्स',
        'toggleTitle': 'भाषा बदलें',
        'tapToAdd': 'बिलिंग',
        'viewCart': 'कार्ट देखें',
        'Menu': 'मेन्यू',
        'Sign Out': 'साइन आउट',
        'Ready to leave?': 'जाने के लिए तैयार हैं?',
        'Log out from': 'से लॉग आउट करें',
        'Sign Out Now': 'अभी साइन आउट करें',
        'Stay Logged In': 'लॉग इन रहें',
        'Records': 'रिकॉर्ड',
        'Group Buy': 'ग्रुप बाय',
        'Expiry & Waste': 'समाप्ति और अपशिष्ट',
        'GST & ITR': 'GST और ITR',
        'WhatsApp Desk': 'व्हाट्सएप डेस्क',
        'Recovery Agent': 'रिकवरी एजेंट',
        'Order Summary': 'ऑर्डर सारांश',
        'Identify Customer': 'ग्राहक की पहचान करें',
        'Select Payment': 'भुगतान का चयन करें',
        'Proceed': 'आगे बढ़ें',
        'Items': 'वस्तुएं',
        'Select Customer': 'ग्राहक चुनें',
        'Search by name or phone': 'नाम या फोन से खोजें',
        'Register New Customer': 'नया ग्राहक पंजीकृत करें',
        'New Customer': 'नया ग्राहक',
        'Save & Pay': 'सहेजें और भुगतान करें',
        'Udhaar Score': 'उधार स्कोर',
        'Available Credit': 'उपलब्ध क्रेडिट',
        'Select Payment Method': 'भुगतान विधि चुनें',
        'Cash': 'नकद',
        'Pay with physical currency': 'भौतिक मुद्रा के साथ भुगतान करें',
        'UPI / Online': 'UPI / ऑनलाइन',
        'PhonePe, GPay, Paytm': 'PhonePe, GPay, Paytm',
        'Udhaar (Credit)': 'उधार (क्रेडिट)',
        'Limit Exceeded': 'सीमा पार हो गई',
        'Total Amount': 'कुल राशि',
        'Success!': 'सफल!',
        'Payment Received': 'भुगतान प्राप्त हुआ',
        'Total Amount Paid': 'कुल भुगतान की गई राशि',
        'Download PDF': 'PDF डाउनलोड करें',
        'Share PDF': 'PDF साझा करें',
        'Send WhatsApp': 'व्हाट्सएप भेजें',
        'OK, NEXT BILL': 'ठीक है, अगला बिल',
        'Cancel': 'रद्द करें',
        'Verifying...': 'सत्यापित किया जा रहा है...',
        'Collect': 'इकट्ठा करें',
        'Pay': 'भुगतान करें',
        'via UPI': 'UPI के माध्यम से',
        'Add': 'जोड़ें',
        'to Udhaar': 'उधार में',
        "OTP sent to customer's WhatsApp": "ग्राहक के व्हाट्सएप पर OTP भेजा गया",
        'Enter 6-Digit Code': '6-अंकों का कोड दर्ज करें',
        'Confirm & Complete': 'पुष्टि करें और पूरा करें',
        'Verifying UPI...': 'UPI सत्यापित किया जा रहा है...',
        'Processing Cash...': 'नकद संसाधित किया जा रहा है...',
        'Customer Verification': 'ग्राहक सत्यापन',
        'Sending verification code...': 'सत्यापन कोड भेजा जा रहा है...',
        'Unnamed Customer': 'अनाम ग्राहक',
        'GLOBAL': 'ग्लोबल',
        'Searching globally...': 'विश्व स्तर पर खोजा जा रहा है...',
        'No results found for': 'कोई परिणाम नहीं मिला',
        'Add to your shop network': 'अपने शॉप नेटवर्क में जोड़ें',
        'Back': 'पीछे',
        'available': 'उपलब्ध',
        'Pay on credit': 'क्रेडिट पर भुगतान करें',
        'Dues': 'बकाया',
        'Searching...': 'खोजा जा रहा है...',
        'Reset Filters': 'फ़िल्टर रीसेट करें',
        'Add Product': 'उत्पाद जोड़ें',
        'Scan Barcode': 'बारकोड स्कैन करें',
        'Categories': 'श्रेणियाँ',
        'All Categories': 'सभी श्रेणियाँ',
        'Low Stock': 'कम स्टॉक',
        'Out of Stock': 'स्टॉक खत्म',
        'Available': 'उपलब्ध',
        'Update Quantity': 'मात्रा अपडेट करें',
        'Increase': 'बढ़ाएं',
        'Decrease': 'घटाएं',
        'Remove': 'हटाएं',
        'Clear All': 'सभी साफ करें',
        'Cart cleared': 'कार्ट खाली कर दिया गया',
        'Only': 'केवल',
        'Search products...': 'उत्पाद खोजें...',
        'Scan': 'स्कैन',
        'Filter': 'फ़िल्टर',
        'All': 'सभी',
        'Out': 'खत्म',
        'Low': 'कम',
        'Checkout': 'चेकआउट',
        'Scan product barcode': 'उत्पाद बारकोड स्कैन करें',
        'Full Name': 'पूरा नाम',
        'Phone Number': 'फ़ोन नंबर',
        'e.g. Rahul Sharma': 'जैसे: राहुल शर्मा',
        '10-digit mobile': '10-अंकों का मोबाइल',
        'Are you sure you want to clear the entire cart?': 'क्या आप वाकई पूरा कार्ट खाली करना चाहते हैं?',
        'Credit Limit Exceeded!': 'क्रेडिट सीमा समाप्त हो गई!',
        'Enter valid 10-digit phone number': 'वैध 10-अंकों का फोन नंबर दर्ज करें',
        'New customer created': 'नया ग्राहक बनाया गया',
        'Customer identified': 'ग्राहक की पहचान की गई',
        'Transaction successful!': 'लेन-देन सफल रहा!',
        'UPI Payment Successful!': 'UPI भुगतान सफल रहा!',
        'Verification code sent to customer': 'ग्राहक को सत्यापन कोड भेजा गया',
        'Failed to send OTP': 'OTP भेजने में विफल',
        'Udhaar Verified & Transaction Complete!': 'उधार सत्यापित और लेनदेन पूरा हुआ!',
        'Invoice Downloaded': 'बीजक डाउनलोड हो गया',
        'Invoice Shared Successfully': 'बीजक सफलतापूर्वक साझा किया गया',
        'Bill sent to customer on WhatsApp': 'ग्राहक को व्हाट्सएप पर बिल भेजा गया',
        'left': 'बाकी',
        'ADD': 'जोड़ें',
        'Sold Out': 'बिक गया',
        'OUT OF STOCK': 'स्टॉक खत्म',
        'Type name or 10-digit phone...': 'नाम या 10-अंकों का फोन दर्ज करें...',
        'Select a payment method': 'एक भुगतान विधि चुनें',
        'Retail Invoice': 'खुदरा बीजक',
        'Date': 'तारीख',
        'Customer': 'ग्राहक',
        'Walk-in Customer': 'वॉक-इन ग्राहक',
        'Item': 'आइटम',
        'Qty': 'मात्रा',
        'Rate': 'दर',
        'Amount': 'रकम',
        'Grand Total': 'कुल योग',
        'Thank you for shopping!': 'खरीदारी के लिए धन्यवाद!',
        'Powered by': 'द्वारा संचालित',
        'Shop Invoice': 'दुकान का बीजक',
        'Here is your invoice for': 'यहाँ आपका बीजक है',
        'Dashboard': 'डैशबोर्ड',
        'Last 30 Days': 'पिछले 30 दिन',
        'Total Revenue': 'कुल राजस्व',
        'Total Orders': 'कुल ऑर्डर',
        'across all channels': 'सभी माध्यमों में',
        'Avg. Order Value': 'औसत ऑर्डर मूल्य',
        'per customer': 'प्रति ग्राहक',
        'Revenue Trend': 'राजस्व रुझान',
        'Revenue': 'राजस्व',
        'No revenue data available': 'कोई राजस्व डेटा उपलब्ध नहीं है',
        'Payment Distribution': 'भुगतान वितरण',
        'No payment data': 'कोई भुगतान डेटा नहीं',
        'Product Sales Share': 'उत्पाद बिक्री हिस्सेदारी',
        'No product data': 'कोई उत्पाद डेटा नहीं',
        'Top Selling Products': 'सबसे ज्यादा बिकने वाले उत्पाद',
        'Top Customers': 'शीर्ष ग्राहक',
        'No customer data yet': 'अभी तक कोई ग्राहक डेटा नहीं है',
        'orders': 'ऑर्डर',
        'Add Item': 'आइटम जोड़ें',
        'Price': 'कीमत',
        'Add 20+ starter items to your inventory?': 'क्या आप अपनी इन्वेंट्री में 20+ शुरुआती आइटम जोड़ना चाहते हैं?',
        'Inventory filled!': 'इन्वेंट्री भर गई!',
        'Failed to seed': 'सीड करने में विफल',
        'Active Udhaar': 'सक्रिय उधार',
        'Pending dues management': 'लंबित बकाया प्रबंधन',
        'Active Debtors': 'सक्रिय देनदार',
        'Search debtors...': 'देनदारों को खोजें...',
        'No pending udhaar found!': 'कोई लंबित उधार नहीं मिला!',
        'Due Amount': 'बकाया राशि',
        'Settle Dues': 'बकाया चुकाएं',
        'Credit Health': 'क्रेडिट स्थिति',
        'Why this score for': 'इसके लिए यह स्कोर क्यों',
        'Current Rating': 'वर्तमान रेटिंग',
        'Credit Limit': 'क्रेडिट सीमा',
        'Based strictly on behavior logic.': 'व्यवहार तर्क पर आधारित।',
        'Logic Reasons': 'तर्क के कारण',
        'GOT IT': 'समझ गया',
        'Record Payment': 'भुगतान रिकॉर्ड करें',
        'Amount to Settle': 'चुकाने की राशि',
        'Total Dues': 'कुल बकाया',
        'Payment Mode': 'भुगतान विधि',
        'UPI / ONLINE': 'UPI / ऑनलाइन',
        'Due Balance': 'बकाया शेष',
        'Activity Log': 'गतिविधि लॉग',
        'SETTLE DUES': 'बकाया चुकाएं',
        'Udhaar Debt': 'उधार ऋण',
        'Settlements': 'बस्तियां',
        'Instant Paid': 'तत्काल भुगतान',
        'Total Outstanding': 'कुल बकाया',
        'Success': 'सफलता',
        'Avg. Days': 'औसत दिन',
        'Pending': 'लंबित',
        'Follow-ups': 'फॉलो-अप',
        'AI Voice Control': 'AI वॉयस कंट्रोल',
        'Automated recovery for': 'स्वचालित रिकवरी',
        'All Clear': 'सब साफ',
        'No actions required': 'कोई कार्रवाई आवश्यक नहीं',
        'RECOVER': 'रिकवर करें',
        'HIGH': 'उच्च',
        'MEDIUM': 'मध्यम',
        'LOW': 'कम',
    },
    te: {
        'Billing': 'బిల్లింగ్',
        'Customers': 'కస్టమర్లు',
        'Products': 'ఉత్పత్తులు',
        'Udhaar': 'ఉధార్',
        'Stock': 'స్టాక్',
        'Payments': 'చెల్లింపులు',
        'Analytics': 'అనలిటిక్స్',
        'toggleTitle': 'భాష మార్చండి',
        'tapToAdd': 'బిల్లింగ్',
        'viewCart': 'కార్ట్ చూడండి',
        'Menu': 'మెనూ',
        'Sign Out': 'సైన్ అవుట్',
        'Ready to leave?': 'నిష్క్రమించాలనుకుంటున్నారా?',
        'Log out from': 'నుండి లాగ్ అవుట్ చేయండి',
        'Sign Out Now': 'ఇప్పుడే సైన్ అవుట్ చేయండి',
        'Stay Logged In': 'లాగిన్ అయి ఉండండి',
        'Records': 'రికార్దులు',
        'Group Buy': 'గ్రూప్ బై',
        'Expiry & Waste': 'ఎక్స్‌పైరీ & వేస్ట్',
        'GST & ITR': 'GST & ITR',
        'WhatsApp Desk': 'వాట్సాప్ డెస్క్',
        'Recovery Agent': 'రికవరీ ఏజెంట్',
        'Order Summary': 'ఆర్డర్ సారాంశం',
        'Identify Customer': 'కస్టమర్‌ను గుర్తించండి',
        'Select Payment': 'చెల్లింపును ఎంచుకోండి',
        'Proceed': 'కొనసాగించు',
        'Items': 'వస్తువులు',
        'Select Customer': 'కస్టమర్‌ని ఎంచుకోండి',
        'Search by name or phone': 'పేరు లేదా ఫోన్‌తో శోధించండి',
        'Register New Customer': 'కొత్త కస్టమర్‌ను నమోదు చేయండి',
        'New Customer': 'కొత్త కస్టమర్',
        'Save & Pay': 'సేవ్ చేసి చెల్లించండి',
        'Udhaar Score': 'ఉధార్ స్కోర్',
        'Available Credit': 'అందుబాటులో ఉన్న క్రెడిట్',
        'Select Payment Method': 'చెల్లింపు పద్ధతిని ఎంచుకోండి',
        'Cash': 'నగదు',
        'Pay with physical currency': 'నగదు రూపంలో చెల్లించండి',
        'UPI / Online': 'UPI / ఆన్‌లైన్',
        'PhonePe, GPay, Paytm': 'PhonePe, GPay, Paytm',
        'Udhaar (Credit)': 'ఉధార్ (క్రెడిట్)',
        'Limit Exceeded': 'పరిమితి మించిపోయింది',
        'Total Amount': 'మొత్తం సొమ్ము',
        'Success!': 'విజయం!',
        'Payment Received': 'చెల్లింపు అందింది',
        'Total Amount Paid': 'మొత్తం చెల్లించిన సొమ్ము',
        'Download PDF': 'PDF డౌన్‌లోడ్ చేయండి',
        'Share PDF': 'PDF భాగస్వామ్యం చేయండి',
        'Send WhatsApp': 'వాట్సాప్ పంపండి',
        'OK, NEXT BILL': 'సరే, తదుపరి బిల్లు',
        'Cancel': 'రద్దు చేయి',
        'Verifying...': 'ధృవీకరిస్తోంది...',
        'Collect': 'వసూలు చేయండి',
        'Pay': 'చెల్లించండి',
        'via UPI': 'UPI ద్వారా',
        'Add': 'జత చేయి',
        'to Udhaar': 'ఉధార్‌కు',
        "OTP sent to customer's WhatsApp": "కస్టమర్ వాట్సాప్‌కు OTP పంపబడింది",
        'Enter 6-Digit Code': '6 అంకెల కోడ్‌ను నమోదు చేయండి',
        'Confirm & Complete': 'ధృవీకరిించి పూర్తి చేయండి',
        'Verifying UPI...': 'UPI ధృవీకరిస్తోంది...',
        'Processing Cash...': 'నగదు ప్రాసెస్ చేస్తోంది...',
        'Customer Verification': 'కస్టమర్ ధృవీకరణ',
        'Sending verification code...': 'ధృవీకరణ కోడ్ పంపుతోంది...',
        'Unnamed Customer': 'పేరు లేని వినియోగదారుడు',
        'GLOBAL': 'గ్రూప్',
        'Searching globally...': 'ప్రపంచవ్యాప్తంగా శోధిస్తోంది...',
        'No results found for': 'ఫలితాలు ఏవీ కనుగొనబడలేదు',
        'Add to your shop network': 'మీ షాప్ నెట్‌వర్క్‌కు జోడించండి',
        'Back': 'వెనుకకు',
        'available': 'అందుబాటులో ఉంది',
        'Pay on credit': 'క్రెడిట్‌పై చెల్లించండి',
        'Dues': 'బకాయిలు',
        'Searching...': 'శోధిస్తోంది...',
        'Reset Filters': 'ఫిల్టర్‌లను రీసెట్ చేయండి',
        'Add Product': 'వస్తువును జోడించు',
        'Scan Barcode': 'బార్‌కోడ్ స్కాన్ చేయండి',
        'Categories': 'వర్గాలు',
        'All Categories': 'అన్ని వర్గాలు',
        'Low Stock': 'తక్కువ స్టాక్',
        'Out of Stock': 'స్టాక్ లేదు',
        'Available': 'అందుబాటులో ఉంది',
        'Update Quantity': 'పరిమాణాన్ని నవీకరించండి',
        'Increase': 'శీర్షిక',
        'Decrease': 'తగ్గించు',
        'Remove': 'తొలగించు',
        'Clear All': 'అన్నీ తుడిచివేయండి',
        'Cart cleared': 'కార్ట్ ఖాళీ చేయబడింది',
        'Only': 'మాత్రమే',
        'Search products...': 'వస్తువులను వెతకండి...',
        'Scan': 'స్కాన్',
        'Filter': 'వడపోత',
        'All': 'అన్నీ',
        'Out': 'లేదు',
        'Low': 'తక్కువ',
        'Checkout': 'చెకౌట్',
        'Scan product barcode': 'వస్తువు బార్‌కోడ్‌ను స్కాన్ చేయండి',
        'Full Name': 'పూర్తి పేరు',
        'Phone Number': 'ఫోన్ నంబర్',
        'e.g. Rahul Sharma': 'ఉదా: రాహుల్ శర్మ',
        '10-digit mobile': '10-అంకెల మొబైల్',
        'Are you sure you want to clear the entire cart?': 'మీరు నిజంగా క్యార్ట్‌ను ఖాళీ చేయాలనుకుంటున్నారా?',
        'Credit Limit Exceeded!': 'క్రెడిట్ పరిమితి మించిపోయింది!',
        'Enter valid 10-digit phone number': 'సరైన 10-అంకెల ఫోన్ నంబర్‌ను నమోదు చేయండి',
        'New customer created': 'కొత్త కస్టమర్ సృష్టించబడింది',
        'Customer identified': 'కస్టమర్ గుర్తించబడ్డారు',
        'Transaction successful!': 'లావాదేవీ విజయవంతమైంది!',
        'UPI Payment Successful!': 'UPI చెల్లింపు విజయవంతమైంది!',
        'Verification code sent to customer': 'కస్టమర్‌కు ధృవీకరణ కోడ్ పంపబడింది',
        'Failed to send OTP': 'OTP పంపడంలో విఫలమైంది',
        'Udhaar Verified & Transaction Complete!': 'ఉధార్ ధృవీకరించబడింది మరియు లావాదేవీ పూర్తయింది!',
        'Invoice Downloaded': 'ఇన్వాయిస్ డౌన్‌లోడ్ చేయబడింది',
        'Invoice Shared Successfully': 'ఇన్వాయిస్ విజయవంతంగా భాగస్వామ్యం చేయబడింది',
        'Bill sent to customer on WhatsApp': 'కస్టమర్‌కు వాట్సాప్‌లో బిల్లు పంపబడింది',
        'left': 'మిగిలి ఉంది',
        'ADD': 'జత చేయి',
        'Sold Out': 'అయిపోయింది',
        'OUT OF STOCK': 'స్టాక్ లేదు',
        'Type name or 10-digit phone...': 'పేరు లేదా 10-అంకెల ఫోన్ నమోదు చేయండి...',
        'Select a payment method': 'చెల్లింపు పద్ధతిని ఎంచుకోండి',
        'Retail Invoice': 'రిటైల్ ఇన్వాయిస్',
        'Date': 'తేదీ',
        'Customer': 'కస్టమర్',
        'Walk-in Customer': 'వాక్-ఇన్ కస్టమర్',
        'Item': 'వస్తువు',
        'Qty': 'పరిమాణం',
        'Rate': 'ధర',
        'Amount': 'మొత్తం',
        'Grand Total': 'మొత్తం సొమ్ము',
        'Thank you for shopping!': 'షాపింగ్ చేసినందుకు ధన్యవాదాలు!',
        'Powered by': 'ద్వారా ఆధారితం',
        'Shop Invoice': 'షాప్ ఇన్వాయిస్',
        'Here is your invoice for': 'ఇది మీ ఇన్వాయిస్',
        'Dashboard': 'డాష్‌బోర్డ్',
        'Last 30 Days': 'గత 30 రోజులు',
        'Total Revenue': 'మొత్తం రాబడి',
        'Total Orders': 'మొత్తం ఆర్డర్లు',
        'across all channels': 'అన్ని ఛానల్స్‌లో',
        'Avg. Order Value': 'సగటు ఆర్డర్ విలువ',
        'per customer': 'ఒక కస్టమర్‌కు',
        'Revenue Trend': 'రాబడి ధోరణి',
        'Revenue': 'రాబడి',
        'No revenue data available': 'రాబడి డేటా అందుబాటులో లేదు',
        'Payment Distribution': 'చెల్లింపు పంపిణీ',
        'No payment data': 'చెల్లింపు డేటా లేదు',
        'Product Sales Share': 'ఉత్పత్తి అమ్మకాల వాటా',
        'No product data': 'ఉత్పత్తి డేటా లేదు',
        'Top Selling Products': 'అత్యధికంగా అమ్ముడైన ఉత్పత్తులు',
        'Top Customers': 'టాప్ కస్టమర్లు',
        'No customer data yet': 'ఇంకా కస్టమర్ డేటా లేదు',
        'orders': 'ఆర్డర్లు',
        'Add Item': 'వస్తువును జోడించండి',
        'Price': 'ధర',
        'Inventory filled!': 'ఇన్వెంటరీ నిండిపోయింది!',
        'Failed to seed': 'డేటా చేర్చడం విఫలమైంది',
        'Active Udhaar': 'సక్రియాత్మక ఉధార్',
        'Pending dues management': 'బకాయిల నిర్వహణ',
        'Active Debtors': 'చురుకైన రుణగ్రహీతలు',
        'Search debtors...': 'రుణగ్రహీతలను వెతకండి...',
        'No pending udhaar found!': 'బకాయిలు ఏవీ లేవు!',
        'Due Amount': 'బకాయి మొత్తం',
        'Settle Dues': 'బకాయిలు చెల్లించండి',
        'Credit Health': 'క్రెడిట్ ఆరోగ్యం',
        'Why this score for': 'దీనికి ఈ స్కోరు ఎందుకు',
        'Current Rating': 'మొత్తం రేటింగ్',
        'Credit Limit': 'క్రెడిట్ పరిమితి',
        'Based strictly on behavior logic.': 'ప్రవర్తన ఆధారంగా.',
        'Logic Reasons': 'కారణాలు',
        'GOT IT': 'సరే, అర్థమైంది',
        'Record Payment': 'చెల్లింపు రికార్డ్ చేయండి',
        'Amount to Settle': 'చెల్లించాల్సిన మొత్తం',
        'Total Dues': 'మొత్తం బకాయిలు',
        'Payment Mode': 'చెల్లింపు విధానం',
        'UPI / ONLINE': 'UPI / ఆన్‌లైన్',
        'Due Balance': 'బకాయి బ్యాలెన్స్',
        'Activity Log': 'కార్యాచరణ లాగ్',
        'SETTLE DUES': 'బకాయిలు చెల్లించండి',
        'Udhaar Debt': 'ఉధార్ అప్పు',
        'Settlements': 'చెల్లింపులు',
        'Instant Paid': 'తక్షణ చెల్లింపు',
        'Total Outstanding': 'మొత్తం బకాయి',
        'Success': 'విజయం',
        'Avg. Days': 'సగటు రోజులు',
        'Pending': 'పెండింగ్‌లో ఉంది',
        'Follow-ups': 'ఫాలో-అప్‌లు',
        'AI Voice Control': 'AI వాయిస్ కంట్రోల్',
        'Automated recovery for': 'కోసం స్వయంచాలక పునరుద్ధరణ',
        'All Clear': 'అన్నీ క్లియర్',
        'No actions required': 'చర్యలు అవసరం లేదు',
        'RECOVER': 'రికవర్',
        'HIGH': 'ఎక్కువ',
        'MEDIUM': 'మధ్యస్థం',
        'LOW': 'తక్కువ',
    },
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: any;
    translate: (text: string) => string;
    batchTranslate: (texts: string[]) => Promise<Record<string, string>>;
    toggleLanguage: () => void;
    isTranslating: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>(() => {
        return (localStorage.getItem('preferred_language') as Language) || 'en';
    });

    const [cache, setCache] = useState<Record<string, Record<string, string>>>(() => {
        const h = localStorage.getItem('translations_cache_v2');
        return h ? JSON.parse(h) : { en: {}, hi: {}, te: {} };
    });

    const [isTranslating, setIsTranslating] = useState(false);

    useEffect(() => {
        localStorage.setItem('preferred_language', language);
    }, [language]);

    useEffect(() => {
        localStorage.setItem('translations_cache_v2', JSON.stringify(cache));
    }, [cache]);

    const batchTranslate = React.useCallback(async (texts: string[]): Promise<Record<string, string>> => {
        if (language === 'en') {
            const result: Record<string, string> = {};
            texts.forEach(t => result[t] = t);
            return result;
        }

        const uniqueTexts = Array.from(new Set(texts.filter(Boolean)));
        const results: Record<string, string> = {};
        const missing: string[] = [];

        uniqueTexts.forEach(t => {
            if (cache[language][t]) {
                results[t] = cache[language][t];
            } else {
                missing.push(t);
            }
        });

        if (missing.length === 0) return results;

        setIsTranslating(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5001/api'}/ai/batch-translate`, {
                texts: missing,
                targetLanguage: language
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const translations = res.data.translations;
            setCache(prev => ({
                ...prev,
                [language]: { ...prev[language], ...translations }
            }));

            return { ...results, ...translations };
        } catch (err) {
            console.error('Batch translation failed:', err);
            return results;
        } finally {
            setIsTranslating(false);
        }
    }, [language, cache]);

    const pendingTranslations = React.useRef<Set<string>>(new Set());
    const batchTimeout = React.useRef<any>(null);

    const processPendingTranslations = React.useCallback(async () => {
        if (pendingTranslations.current.size === 0) return;

        const textsToTranslate = Array.from(pendingTranslations.current);
        pendingTranslations.current.clear();

        await batchTranslate(textsToTranslate);
    }, [batchTranslate]);

    const translate = React.useCallback((text: string): string => {
        if (!text || language === 'en') return text;

        // Check cache first
        if (cache[language][text]) return cache[language][text];

        // Check static translations as well just in case (though proxy usually handles this)
        const staticForLang = staticTranslations[language] || staticTranslations.en;
        if (text in staticForLang) return (staticForLang as any)[text];

        // Add to pending set for batch processing
        pendingTranslations.current.add(text);

        if (batchTimeout.current) clearTimeout(batchTimeout.current);
        batchTimeout.current = setTimeout(processPendingTranslations, 50); // 50ms window to collect strings

        return text;
    }, [language, cache, processPendingTranslations]);

    const toggleLanguage = React.useCallback(() => {
        setLanguage(prev => {
            if (prev === 'en') return 'hi';
            if (prev === 'hi') return 'te';
            return 'en';
        });
    }, []);

    const t = React.useMemo(() => {
        const staticForLang = staticTranslations[language] || staticTranslations.en;
        return new Proxy(staticForLang, {
            get: (target: any, prop: string) => {
                if (prop in target) return target[prop];
                return translate(prop);
            }
        });
    }, [language, translate]);

    const contextValue = React.useMemo(() => ({
        language,
        setLanguage,
        t,
        translate,
        batchTranslate,
        toggleLanguage,
        isTranslating
    }), [language, t, translate, batchTranslate, toggleLanguage, isTranslating]);

    return (
        <LanguageContext.Provider value={contextValue}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
};
