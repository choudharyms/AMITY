#!/usr/bin/env python3
"""
AaharSetu Multi-City Synthetic Data Generator & Seeder
Generates realistic food rescue network nodes (donors, shelters, drivers, donations, events, records)
for all 10 supported Indian cities across their respective city areas.
"""

import os
import sys
import json
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
import httpx
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("VITE_SUPABASE_KEY", "")

# 10 Major Indian Cities with authentic local areas and coordinates
CITIES_DATA = {
    "blr": {
        "name": "Bengaluru",
        "state": "Karnataka",
        "lat": 12.9716, "lng": 77.5946,
        "areas": [
            {"name": "Indiranagar", "lat": 12.9784, "lng": 77.6408, "donor": "Toit Brewpub & Kitchen", "type": "restaurant", "shelter": "Udaya Hope Shelter"},
            {"name": "Koramangala", "lat": 12.9352, "lng": 77.6245, "donor": "Truffles Gourmet Diner", "type": "cafe", "shelter": "Sneha Karuna Community Home"},
            {"name": "Majestic", "lat": 12.9767, "lng": 77.5713, "donor": "Hotel Annapurna Grand", "type": "hotel", "shelter": "Ashraya Night Shelter"},
            {"name": "HSR Layout", "lat": 12.9121, "lng": 77.6446, "donor": "The Baker's Dozen Artisan", "type": "bakery", "shelter": "Kavya Evening Shelter"},
            {"name": "Whitefield", "lat": 12.9698, "lng": 77.7499, "donor": "Green Farm Organics", "type": "market", "shelter": "Sarthi Children's Home"},
            {"name": "Electronic City", "lat": 12.8452, "lng": 77.6602, "donor": "City Tech Campus Canteen", "type": "cafeteria", "shelter": "Vikas Orphanage & Kitchen"},
            {"name": "Lalbagh", "lat": 12.9554, "lng": 77.5855, "donor": "MTR Heritage Bhavan", "type": "restaurant", "shelter": "Prerana Relief Center"},
            {"name": "Malleshwaram", "lat": 13.0031, "lng": 77.5643, "donor": "Nandini Deluxe Sweets", "type": "sweetshop", "shelter": "Naya Savera Center"},
            {"name": "Jayanagar", "lat": 12.9250, "lng": 77.5938, "donor": "The Daily Palette Caterers", "type": "caterer", "shelter": "Devi Charitable Trust Kitchen"},
            {"name": "Basavanagudi", "lat": 12.9416, "lng": 77.5742, "donor": "Mysore Tiffin Room", "type": "restaurant", "shelter": "Amara Senior Care Kitchen"},
        ],
        "driver_names": ["Rajesh Kumar", "Kiran Shetty", "Ankita Sharma", "Meera Nair", "Priya Das", "Karthik V."],
    },
    "mum": {
        "name": "Mumbai",
        "state": "Maharashtra",
        "lat": 19.0760, "lng": 72.8777,
        "areas": [
            {"name": "Bandra", "lat": 19.0596, "lng": 72.8295, "donor": "Pali Village Cafe & Bakery", "type": "cafe", "shelter": "St. Jude Child Care Center"},
            {"name": "Andheri", "lat": 19.1136, "lng": 72.8697, "donor": "JW Banquet & Kitchen", "type": "hotel", "shelter": "Samarth Community Kitchen"},
            {"name": "Colaba", "lat": 18.9067, "lng": 72.8147, "donor": "Britannia & Co. Heritage", "type": "restaurant", "shelter": "Asha Daan Mission Shelter"},
            {"name": "Dadar", "lat": 19.0178, "lng": 72.8478, "donor": "Aaswad Maharashtrian Diner", "type": "restaurant", "shelter": "Siddhivinayak Seva Kitchen"},
            {"name": "Juhu", "lat": 19.1075, "lng": 72.8263, "donor": "Sea Princess Grand Buffets", "type": "hotel", "shelter": "Vatsalya Children's Trust"},
            {"name": "Powai", "lat": 19.1176, "lng": 72.9060, "donor": "Hiranandani Corporate Diner", "type": "cafeteria", "shelter": "Vidya Integrated Community Home"},
            {"name": "Lower Parel", "lat": 18.9950, "lng": 72.8247, "donor": "The Bombay Canteen Cloud", "type": "restaurant", "shelter": "Kamala Mills Workers Trust"},
            {"name": "Ghatkopar", "lat": 19.0860, "lng": 72.9080, "donor": "Purohit Thali & Sweets", "type": "caterer", "shelter": "Manav Seva Night Shelter"},
            {"name": "Borivali", "lat": 19.2288, "lng": 72.8541, "donor": "Garden Treat Banquets", "type": "caterer", "shelter": "Shanti Niketan Elderly Care"},
            {"name": "Chembur", "lat": 19.0522, "lng": 72.8994, "donor": "Grand Central Bakery", "type": "bakery", "shelter": "Chembur Children Home"},
        ],
        "driver_names": ["Sachin Patil", "Rohan Sawant", "Farhan Ansari", "Pooja Jadhav", "Deepak Shinde", "Anjali More"],
    },
    "del": {
        "name": "Delhi",
        "state": "Delhi",
        "lat": 28.6139, "lng": 77.2090,
        "areas": [
            {"name": "Connaught Place", "lat": 28.6304, "lng": 77.2177, "donor": "Wenger's Deli & Confectionery", "type": "bakery", "shelter": "Delhi Langar Sewa Shelter"},
            {"name": "Hauz Khas", "lat": 28.5494, "lng": 77.2001, "donor": "Social Heritage Kitchen", "type": "restaurant", "shelter": "Goonj Community Hub"},
            {"name": "Chandni Chowk", "lat": 28.6506, "lng": 77.2303, "donor": "Haldiram's Chandni Sweets", "type": "sweetshop", "shelter": "Fatehpuri Night Refuge"},
            {"name": "Karol Bagh", "lat": 28.6514, "lng": 77.1907, "donor": "Roshan Di Kulfi & Diner", "type": "restaurant", "shelter": "Seva Mandir Relief Home"},
            {"name": "Saket", "lat": 28.5245, "lng": 77.2066, "donor": "Select Food Court Banquets", "type": "cafeteria", "shelter": "Deepalaya Children Home"},
            {"name": "Lajpat Nagar", "lat": 28.5677, "lng": 77.2433, "donor": "Nagpal Chhole Bhature", "type": "restaurant", "shelter": "Sai Kripa Night Shelter"},
            {"name": "Rohini", "lat": 28.7159, "lng": 77.1189, "donor": "Crowne Plaza Grand Buffet", "type": "hotel", "shelter": "Basti Vikas Kendra Kitchen"},
            {"name": "Dwarka", "lat": 28.5921, "lng": 77.0460, "donor": "Dwarka Banquet & Caterers", "type": "caterer", "shelter": "Matri Sudha Relief Center"},
            {"name": "Vasant Kunj", "lat": 28.5293, "lng": 77.1539, "donor": "Bloom Gourmet Kitchen", "type": "cafe", "shelter": "Sankalp Rural-Urban Bridge"},
            {"name": "Mayur Vihar", "lat": 28.6078, "lng": 77.2994, "donor": "Evergreen Sweet House", "type": "sweetshop", "shelter": "Shanti Awas Orphanage"},
        ],
        "driver_names": ["Aman Verma", "Harpreet Singh", "Mohd Rizwan", "Neha Gupta", "Vikram Tomar", "Sunita Rawat"],
    },
    "maa": {
        "name": "Chennai",
        "state": "Tamil Nadu",
        "lat": 13.0827, "lng": 80.2707,
        "areas": [
            {"name": "T. Nagar", "lat": 13.0418, "lng": 80.2341, "donor": "Saravana Bhavan Grand", "type": "restaurant", "shelter": "Anbagam Night Shelter"},
            {"name": "Adyar", "lat": 13.0012, "lng": 80.2565, "donor": "The French Loaf Bakery", "type": "bakery", "shelter": "Banyan Mental Health Trust"},
            {"name": "Mylapore", "lat": 13.0368, "lng": 80.2676, "donor": "Rayar's Heritage Mess", "type": "restaurant", "shelter": "Santhome Community Center"},
            {"name": "Anna Nagar", "lat": 13.0850, "lng": 80.2101, "donor": "Hot Breads Patisserie", "type": "bakery", "shelter": "Arundhathi Relief Kitchen"},
            {"name": "Velachery", "lat": 12.9815, "lng": 80.2180, "donor": "Phoenix Tech Dining", "type": "cafeteria", "shelter": "Annai Teresa Shelter"},
            {"name": "Nungambakkam", "lat": 13.0569, "lng": 80.2425, "donor": "Taj Connemara Kitchen", "type": "hotel", "shelter": "Seva Chakkara Orphanage"},
            {"name": "Guindy", "lat": 13.0067, "lng": 80.2025, "donor": "ITC Grand Chola Buffet", "type": "hotel", "shelter": "Little Drops Elderly Care"},
            {"name": "Royapettah", "lat": 13.0538, "lng": 80.2605, "donor": "Amethyst Gourmet Garden", "type": "cafe", "shelter": "Udhavum Karangal Home"},
            {"name": "Besant Nagar", "lat": 12.9990, "lng": 80.2710, "donor": "Cozee Coastal Cafe", "type": "cafe", "shelter": "Olcott Memorial Kitchen"},
            {"name": "Alwarpet", "lat": 13.0334, "lng": 80.2505, "donor": "Chamiers Kitchen & Deli", "type": "restaurant", "shelter": "Ashraya Children Haven"},
        ],
        "driver_names": ["Murugan S.", "Suresh Kumar", "Revathi R.", "Dinesh Karthik", "Kavitha M.", "Arun Balaji"],
    },
    "hyd": {
        "name": "Hyderabad",
        "state": "Telangana",
        "lat": 17.3850, "lng": 78.4867,
        "areas": [
            {"name": "Banjara Hills", "lat": 17.4156, "lng": 78.4350, "donor": "Taj Krishna Grand Buffet", "type": "hotel", "shelter": "Sparsh Hospice Care Trust"},
            {"name": "Jubilee Hills", "lat": 17.4319, "lng": 78.4073, "donor": "Concu Patisserie", "type": "bakery", "shelter": "Aman Vedika Rainbow Home"},
            {"name": "Hitec City", "lat": 17.4435, "lng": 78.3772, "donor": "Cyber Gateway Food Court", "type": "cafeteria", "shelter": "Robin Hood Army Hitec Hub"},
            {"name": "Gachibowli", "lat": 17.4401, "lng": 78.3489, "donor": "Sheraton Hyderabad Diner", "type": "hotel", "shelter": "Choti Si Asha Foundation"},
            {"name": "Begumpet", "lat": 17.4447, "lng": 78.4664, "donor": "Pista House Authentic", "type": "restaurant", "shelter": "Don Bosco Navajeevan Shelter"},
            {"name": "Secunderabad", "lat": 17.4399, "lng": 78.4983, "donor": "Paradise Food Court Grand", "type": "restaurant", "shelter": "Mother Teresa Home Secunderabad"},
            {"name": "Madhapur", "lat": 17.4483, "lng": 78.3915, "donor": "Chutneys Family Mess", "type": "restaurant", "shelter": "Pratyusha Community Kitchen"},
            {"name": "Kukatpally", "lat": 17.4947, "lng": 78.3996, "donor": "Bawarchi Biryani Centre", "type": "restaurant", "shelter": "Sankalp Children Trust"},
            {"name": "Charminar", "lat": 17.3616, "lng": 78.4747, "donor": "Shadab Hotel & Kitchen", "type": "restaurant", "shelter": "City Relief Night Shelter"},
            {"name": "Kondapur", "lat": 17.4699, "lng": 78.3578, "donor": "Karachi Bakery Kondapur", "type": "bakery", "shelter": "Akshaya Vidya Center"},
        ],
        "driver_names": ["Syed Imran", "Venkat Reddy", "Ramesh Babu", "Sneha Rao", "Faizan Ahmed", "Prashanth G."],
    },
    "pun": {
        "name": "Pune",
        "state": "Maharashtra",
        "lat": 18.5204, "lng": 73.8567,
        "areas": [
            {"name": "Koregaon Park", "lat": 18.5362, "lng": 73.8940, "donor": "German Bakery Authentic", "type": "bakery", "shelter": "SOFOSH Tara Children Home"},
            {"name": "Kothrud", "lat": 18.5074, "lng": 73.8077, "donor": "Bedekar Tea & Snack House", "type": "restaurant", "shelter": "Apang Kalyan Seva Kendra"},
            {"name": "Viman Nagar", "lat": 18.5679, "lng": 73.9143, "donor": "Hyatt Regency Buffets", "type": "hotel", "shelter": "Viman Relief Foundation"},
            {"name": "Hinjewadi", "lat": 18.5913, "lng": 73.7389, "donor": "Infosys Dining Hall 3", "type": "cafeteria", "shelter": "Maher Community Home"},
            {"name": "Baner", "lat": 18.5590, "lng": 73.7868, "donor": "Malaka Spice Southeast Kitchen", "type": "restaurant", "shelter": "Balgram Children Home"},
            {"name": "Shivajinagar", "lat": 18.5314, "lng": 73.8446, "donor": "Vaishali Cafe FC Road", "type": "restaurant", "shelter": "Pune Station Night Shelter"},
            {"name": "Kalyani Nagar", "lat": 18.5463, "lng": 73.9034, "donor": "Flour Works Artisan Deli", "type": "bakery", "shelter": "Deepgriha Society Kitchen"},
            {"name": "Aundh", "lat": 18.5580, "lng": 73.8075, "donor": "Poli Bhaji Kendra Aundh", "type": "caterer", "shelter": "Snehwan Rural Refuge"},
            {"name": "Magarpatta", "lat": 18.5133, "lng": 73.9248, "donor": "Destination Center Diner", "type": "cafeteria", "shelter": "Hadapsar Shanti Bhavan"},
            {"name": "Hadapsar", "lat": 18.5089, "lng": 73.9259, "donor": "Kaka Halwai Sweets", "type": "sweetshop", "shelter": "Matruchhaya Orphanage"},
        ],
        "driver_names": ["Omkar Deshmukh", "Nikhil Kadam", "Tanvi Joshi", "Aditya More", "Swapnil Shinde", "Pooja Gaikwad"],
    },
    "kol": {
        "name": "Kolkata",
        "state": "West Bengal",
        "lat": 22.5726, "lng": 88.3639,
        "areas": [
            {"name": "Park Street", "lat": 22.5510, "lng": 88.3524, "donor": "Flurrys Tearoom & Bakery", "type": "bakery", "shelter": "Missionaries of Charity Shishu Bhavan"},
            {"name": "Salt Lake", "lat": 22.5867, "lng": 88.4178, "donor": "Wipro Sector 5 Cafeteria", "type": "cafeteria", "shelter": "Salt Lake Blind School Mess"},
            {"name": "New Town", "lat": 22.5958, "lng": 88.4792, "donor": "Novotel Grand Banquets", "type": "hotel", "shelter": "New Town Seva Sanstha"},
            {"name": "Ballygunge", "lat": 22.5280, "lng": 88.3650, "donor": "6 Ballygunge Place", "type": "restaurant", "shelter": "Calcutta Rescue Community Hall"},
            {"name": "Howrah", "lat": 22.5892, "lng": 88.3090, "donor": "Howrah Station Canteen", "type": "cafeteria", "shelter": "Howrah Night Transit Shelter"},
            {"name": "Gariahat", "lat": 22.5186, "lng": 88.3643, "donor": "Balaram Mullick Sweets", "type": "sweetshop", "shelter": "Gariahat Mahila Ashram"},
            {"name": "Shyambazar", "lat": 22.6001, "lng": 88.3718, "donor": "Golbari Kasha Mangsho", "type": "restaurant", "shelter": "North Kolkata Seva Dal"},
            {"name": "Behala", "lat": 22.4988, "lng": 88.3149, "donor": "Behala Sweets & Snacks", "type": "sweetshop", "shelter": "Samaritan Community Kitchen"},
            {"name": "Alipore", "lat": 22.5312, "lng": 88.3308, "donor": "Taj Bengal Kitchen", "type": "hotel", "shelter": "Bhavan Hope Shelter"},
            {"name": "Esplanade", "lat": 22.5645, "lng": 88.3516, "donor": "Aminia Heritage Restaurant", "type": "restaurant", "shelter": "Esplanade Relief Soup Kitchen"},
        ],
        "driver_names": ["Sourav Roy", "Debashis Mukherjee", "Priyanka Sen", "Rabi Ghosh", "Anirban Das", "Moumita Saha"],
    },
    "amd": {
        "name": "Ahmedabad",
        "state": "Gujarat",
        "lat": 23.0225, "lng": 72.5714,
        "areas": [
            {"name": "Navrangpura", "lat": 23.0373, "lng": 72.5583, "donor": "Swati Snacks Traditional", "type": "restaurant", "shelter": "Manav Sadhna Ashram"},
            {"name": "SG Highway", "lat": 23.0753, "lng": 72.5076, "donor": "Courtyard Marriott Buffet", "type": "hotel", "shelter": "Apang Manav Mandal Home"},
            {"name": "Vastrapur", "lat": 23.0350, "lng": 72.5293, "donor": "Gordhan Thal Gujarati Dining", "type": "restaurant", "shelter": "Vastrapur Community Trust"},
            {"name": "Maninagar", "lat": 22.9978, "lng": 72.6033, "donor": "Das Khaman Sweets House", "type": "sweetshop", "shelter": "Kankaria Bal Vikas Ashram"},
            {"name": "Satellite", "lat": 23.0276, "lng": 72.5170, "donor": "Upper Crust Artisan Breads", "type": "bakery", "shelter": "Prabhat Relief Center"},
            {"name": "Bodakdev", "lat": 23.0441, "lng": 72.5126, "donor": "Rajwadu Banquets", "type": "caterer", "shelter": "Blind People Association Shelter"},
            {"name": "Paldi", "lat": 23.0130, "lng": 72.5625, "donor": "Vishalla Traditional Dining", "type": "restaurant", "shelter": "Paldi Senior Care Trust"},
            {"name": "Bopal", "lat": 23.0343, "lng": 72.4645, "donor": "Bopal Banquet & Caterers", "type": "caterer", "shelter": "Shanti Niketan Orphanage"},
            {"name": "Ashram Road", "lat": 23.0396, "lng": 72.5714, "donor": "Agashiye Heritage Dining", "type": "hotel", "shelter": "Sabarmati Seva Kendra"},
            {"name": "Prahlad Nagar", "lat": 23.0128, "lng": 72.5034, "donor": "Mocha Diner & Cafe", "type": "cafe", "shelter": "Seva Sahayog Foundation Hub"},
        ],
        "driver_names": ["Jignesh Patel", "Parth Shah", "Bhavik Mehta", "Dharini Trivedi", "Hitesh Prajapati", "Kinjal Vora"],
    },
    "jai": {
        "name": "Jaipur",
        "state": "Rajasthan",
        "lat": 26.9124, "lng": 75.7873,
        "areas": [
            {"name": "C-Scheme", "lat": 26.9089, "lng": 75.8016, "donor": "Anokhi Cafe & Deli", "type": "cafe", "shelter": "Rays Aasha Ki Kiran Home"},
            {"name": "Malviya Nagar", "lat": 26.8549, "lng": 75.8243, "donor": "Kanha Sweets & Restaurant", "type": "restaurant", "shelter": "Apna Ghar Seva Ashram"},
            {"name": "Vaishali Nagar", "lat": 26.9090, "lng": 75.7410, "donor": "Brown Sugar Patisserie", "type": "bakery", "shelter": "Vimla Children Home"},
            {"name": "Raja Park", "lat": 26.8967, "lng": 75.8260, "donor": "Sethi Tikka Kabab House", "type": "restaurant", "shelter": "Guru Nanak Langar Trust"},
            {"name": "Mansarovar", "lat": 26.8584, "lng": 75.7667, "donor": "Rawat Mishthan Bhandar", "type": "sweetshop", "shelter": "Mansarovar Relief Haven"},
            {"name": "Pink City", "lat": 26.9239, "lng": 75.8267, "donor": "LMB Laxmi Mishthan Bhandar", "type": "sweetshop", "shelter": "Govind Dev Ji Seva Kitchen"},
            {"name": "Tonk Road", "lat": 26.8410, "lng": 75.7990, "donor": "Chokhi Dhani Banquets", "type": "caterer", "shelter": "Taabar Street Children Trust"},
            {"name": "Bani Park", "lat": 26.9312, "lng": 75.7925, "donor": "Umaid Bhawan Heritage Mess", "type": "hotel", "shelter": "Jaipur Night Shelter 4"},
            {"name": "Jagatpura", "lat": 26.8222, "lng": 75.8648, "donor": "SKIT Campus Dining", "type": "cafeteria", "shelter": "Astitva Welfare Shelter"},
            {"name": "Civil Lines", "lat": 26.9056, "lng": 75.7878, "donor": "ITC Rajputana Buffets", "type": "hotel", "shelter": "Mother Teresa Mission Home"},
        ],
        "driver_names": ["Kuldeep Singh", "Manish Sharma", "Rahul Meena", "Pooja Shekhawat", "Deepak Chouhan", "Sunil Gujjar"],
    },
    "lko": {
        "name": "Lucknow",
        "state": "Uttar Pradesh",
        "lat": 26.8467, "lng": 80.9462,
        "areas": [
            {"name": "Hazratganj", "lat": 26.8500, "lng": 80.9499, "donor": "Royal Cafe Basket Chaat", "type": "restaurant", "shelter": "Hazratganj Rain Basera Shelter"},
            {"name": "Gomti Nagar", "lat": 26.8569, "lng": 81.0006, "donor": "Taj Mahal Hotel Lucknow", "type": "hotel", "shelter": "Aarambh Children Trust"},
            {"name": "Aliganj", "lat": 26.8924, "lng": 80.9442, "donor": "Madhurima Sweets & Diner", "type": "sweetshop", "shelter": "Drishti Community Center"},
            {"name": "Indira Nagar", "lat": 26.8833, "lng": 80.9833, "donor": "Good Bakery Patisserie", "type": "bakery", "shelter": "Navjeevan Relief Home"},
            {"name": "Chowk", "lat": 26.8683, "lng": 80.9038, "donor": "Tunday Kababi Authentic", "type": "restaurant", "shelter": "Chowk Night Shelter Trust"},
            {"name": "Mahanagar", "lat": 26.8778, "lng": 80.9525, "donor": "Dastarkhwan Heritage Mess", "type": "restaurant", "shelter": "Mahanagar Elderly Care"},
            {"name": "Alambagh", "lat": 26.8145, "lng": 80.8994, "donor": "Alambagh Railway Caterers", "type": "cafeteria", "shelter": "Alambagh Transit Shelter"},
            {"name": "Aminabad", "lat": 26.8458, "lng": 80.9276, "donor": "Prakash Kulfi & Sweets", "type": "sweetshop", "shelter": "Ganga Jamuni Relief Hall"},
            {"name": "Jankipuram", "lat": 26.9200, "lng": 80.9500, "donor": "Lucknow University Canteen", "type": "cafeteria", "shelter": "Samarpan Bal Griha"},
            {"name": "Ashiyana", "lat": 26.7885, "lng": 80.9065, "donor": "Piccadily Banquets Kitchen", "type": "hotel", "shelter": "Aashiana Karuna Trust"},
        ],
        "driver_names": ["Mohd Arif", "Shailendra Yadav", "Anupam Mishra", "Shweta Tiwari", "Faheem Khan", "Rakesh Verma"],
    },
}

DONATION_TEMPLATES = [
    {"item": "Fresh Dal Makhani & Jeera Rice (45 servings)", "cat": "cooked_hot", "kg": 20.0, "temp": 72.0, "hours": 3.5, "prep_mins": 45, "status": "posted"},
    {"item": "Assorted Pasta & Garlic Bread Trays", "cat": "cooked_hot", "kg": 15.0, "temp": 68.0, "hours": 3.0, "prep_mins": 60, "status": "posted"},
    {"item": "Artisan Whole Wheat Loaves & Veg Puffs", "cat": "bakery", "kg": 14.0, "temp": None, "hours": 7.0, "prep_mins": 120, "status": "matched"},
    {"item": "Fresh Farm Spinach & Bell Pepper Crates", "cat": "produce", "kg": 35.0, "temp": None, "hours": 16.0, "prep_mins": 90, "status": "accepted"},
    {"item": "Sambar, Mixed Vegetable Curry & Rice (60 meals)", "cat": "cooked_hot", "kg": 26.0, "temp": 75.0, "hours": 2.5, "prep_mins": 75, "status": "picked_up"},
    {"item": "Buffet Dinner Pulao & Paneer Butter Masala", "cat": "cooked_hot", "kg": 22.0, "temp": 64.0, "hours": -1.5, "prep_mins": 360, "status": "delivered"},
    {"item": "Packaged Dry Fruits & Traditional Sweets", "cat": "packaged", "kg": 16.0, "temp": None, "hours": 24.0, "prep_mins": 300, "status": "delivered"},
    {"item": "Morning Idli, Vada & Coconut Chutney Batch", "cat": "cooked_hot", "kg": 12.0, "temp": 30.0, "hours": -3.0, "prep_mins": 480, "status": "expired"},
]

def generate_multi_city_data():
    now = datetime.now(timezone.utc)
    iso = lambda dt: dt.isoformat()

    all_donors = []
    all_recipients = []
    all_drivers = []
    all_donations = []
    all_matches = []
    all_events = []
    all_records = []

    for city_id, city_info in CITIES_DATA.items():
        city_name = city_info["name"]
        areas = city_info["areas"]
        driver_names = city_info["driver_names"]

        # 1. Donors (10 per city)
        city_donors = []
        for i, a in enumerate(areas):
            donor_id = f"donor-{city_id}-{i+1:02d}"
            d_obj = {
                "id": donor_id,
                "city_id": city_id,
                "name": a["donor"],
                "type": a["type"],
                "area": a["name"],
                "latitude": round(a["lat"], 4),
                "longitude": round(a["lng"], 4),
                "contact": f"+91 98{i:02d}0 {city_id.upper()}123",
                "license_no": f"1122{i:02d}3400{city_id.upper()}",
                "license_verified": True if i < 3 else False,
                "is_synthetic": True,
            }
            city_donors.append(d_obj)
        all_donors.extend(city_donors)

        # 2. Recipients / Shelters (8 per city)
        city_recipients = []
        for i, a in enumerate(areas[:8]):
            recip_id = f"recip-{city_id}-{i+1:02d}"
            r_obj = {
                "id": recip_id,
                "city_id": city_id,
                "name": a["shelter"],
                "area": a["name"],
                "latitude": round(a["lat"] + 0.002, 4),
                "longitude": round(a["lng"] - 0.002, 4),
                "capacity_kg": float(60 + (i * 15)),
                "reserved_kg": float(10 + (i * 5)),
                "accepts": json.dumps(["cooked_hot", "cooked_cold", "bakery", "packaged"] if i % 2 == 0 else ["cooked_hot", "produce", "packaged"]),
                "need_level": 5 if i in (0, 3, 6) else 4 if i in (1, 4) else 3,
                "open_hours": "07:30 - 23:00" if i % 2 == 0 else "08:00 - 22:00",
                "approved": True,
                "is_open": True,
                "reliability": round(0.92 + (i * 0.01), 2),
                "is_synthetic": True,
            }
            city_recipients.append(r_obj)
        all_recipients.extend(city_recipients)

        # 3. Volunteer Drivers (6 per city)
        city_drivers = []
        vehicles = ["Bike", "Auto", "Bike", "Eco Van", "Bike", "Auto"]
        capacities = [30.0, 60.0, 25.0, 100.0, 25.0, 55.0]
        for i, name in enumerate(driver_names):
            dr_id = f"driver-{city_id}-{i+1:02d}"
            area = areas[i % len(areas)]
            dr_obj = {
                "id": dr_id,
                "city_id": city_id,
                "name": name,
                "latitude": round(area["lat"] - 0.001, 4),
                "longitude": round(area["lng"] + 0.001, 4),
                "availability": True if i != 3 else False,
                "vehicle": vehicles[i],
                "capacity_kg": capacities[i],
                "telegram_id": f"@{name.lower().replace(' ', '_')}_{city_id}",
                "reliability": round(0.93 + (i * 0.01), 2),
                "is_synthetic": True,
            }
            city_drivers.append(dr_obj)
        all_drivers.extend(city_drivers)

        # 4. Active Donations & Countdowns (8 per city)
        city_donations = []
        for i, tmpl in enumerate(DONATION_TEMPLATES):
            d_id = f"d-{city_id}-{1001 + i}"
            donor = city_donors[i % len(city_donors)]
            prep_at = now - timedelta(minutes=tmpl["prep_mins"])
            safe_at = now + timedelta(hours=tmpl["hours"])
            created_at = prep_at + timedelta(minutes=10)

            recip_id = city_recipients[i % len(city_recipients)]["id"] if tmpl["status"] in ("matched", "accepted", "picked_up", "delivered") else None
            driver_id = city_drivers[i % len(city_drivers)]["id"] if tmpl["status"] in ("matched", "accepted", "picked_up", "delivered") else None

            dn_obj = {
                "id": d_id,
                "city_id": city_id,
                "donor_id": donor["id"],
                "item": tmpl["item"],
                "category": tmpl["cat"],
                "qty_kg": float(tmpl["kg"]),
                "prepared_at": iso(prep_at),
                "temp_c": tmpl["temp"],
                "safe_until": iso(safe_at),
                "status": tmpl["status"],
                "recipient_id": recip_id,
                "driver_id": driver_id,
                "raw_text": f"{tmpl['item']} - {tmpl['kg']}kg surplus from {donor['name']} in {donor['area']}, {city_name}.",
                "is_synthetic": True,
                "created_at": iso(created_at),
            }
            city_donations.append(dn_obj)
        all_donations.extend(city_donations)

        # 5. Matches (2 per city)
        city_matches = [
            {
                "id": f"m-{city_id}-101",
                "city_id": city_id,
                "donation_id": city_donations[2]["id"],
                "recipient_id": city_recipients[2]["id"],
                "score": 0.915,
                "reasons": json.dumps([{"factor": "time_slack", "score": 0.94}, {"factor": "proximity", "score": 0.90}, {"factor": "need", "score": 0.88}]),
                "state": "accepted",
            },
            {
                "id": f"m-{city_id}-102",
                "city_id": city_id,
                "donation_id": city_donations[3]["id"],
                "recipient_id": city_recipients[3]["id"],
                "score": 0.948,
                "reasons": json.dumps([{"factor": "time_slack", "score": 0.98}, {"factor": "proximity", "score": 0.96}, {"factor": "need", "score": 0.90}]),
                "state": "accepted",
            }
        ]
        all_matches.extend(city_matches)

        # 6. Dispatch Events (Audit trails)
        city_events = [
            {
                "id": f"e-{city_id}-01",
                "city_id": city_id,
                "donation_id": city_donations[5]["id"],
                "driver_id": city_drivers[0]["id"],
                "event_type": "delivered",
                "message": f"{city_drivers[0]['name']} delivered {city_donations[5]['qty_kg']:.0f} kg to {city_recipients[0]['name']} within FSSAI safe window.",
                "created_at": iso(now - timedelta(hours=1, minutes=45)),
            },
            {
                "id": f"e-{city_id}-02",
                "city_id": city_id,
                "donation_id": city_donations[6]["id"],
                "driver_id": city_drivers[1]["id"],
                "event_type": "delivered",
                "message": f"{city_drivers[1]['name']} delivered {city_donations[6]['qty_kg']:.0f} kg packaged food to {city_recipients[1]['name']}.",
                "created_at": iso(now - timedelta(hours=2, minutes=10)),
            },
            {
                "id": f"e-{city_id}-03",
                "city_id": city_id,
                "donation_id": city_donations[4]["id"],
                "driver_id": city_drivers[2]["id"],
                "event_type": "picked_up",
                "message": f"{city_drivers[2]['name']} confirmed pickup of {city_donations[4]['qty_kg']:.0f} kg from {city_donors[4]['name']}.",
                "created_at": iso(now - timedelta(minutes=25)),
            },
            {
                "id": f"e-{city_id}-04",
                "city_id": city_id,
                "donation_id": city_donations[2]["id"],
                "driver_id": city_drivers[3]["id"],
                "event_type": "matched",
                "message": f"Rescue matched with {city_recipients[2]['name']}. {city_drivers[3]['name']} assigned.",
                "created_at": iso(now - timedelta(minutes=15)),
            },
            {
                "id": f"e-{city_id}-05",
                "city_id": city_id,
                "donation_id": city_donations[0]["id"],
                "driver_id": None,
                "event_type": "posted",
                "message": f"{city_donors[0]['name']} posted {city_donations[0]['qty_kg']:.0f} kg in {city_donors[0]['area']}.",
                "created_at": iso(now - timedelta(minutes=40)),
            },
        ]
        all_events.extend(city_events)

        # 7. Delivery Records (Verified FSSAI deliveries)
        city_records = [
            {
                "id": f"rec-{city_id}-01",
                "city_id": city_id,
                "donation_id": city_donations[5]["id"],
                "quantity_kg": float(city_donations[5]["qty_kg"]),
                "temperature_c": 64.0,
                "area": city_donors[5]["area"],
                "delivered_at": iso(now - timedelta(hours=1, minutes=45)),
                "consume_by": iso(now + timedelta(hours=2)),
            },
            {
                "id": f"rec-{city_id}-02",
                "city_id": city_id,
                "donation_id": city_donations[6]["id"],
                "quantity_kg": float(city_donations[6]["qty_kg"]),
                "temperature_c": None,
                "area": city_donors[6]["area"],
                "delivered_at": iso(now - timedelta(hours=2, minutes=10)),
                "consume_by": iso(now + timedelta(hours=20)),
            },
        ]
        all_records.extend(city_records)

    return {
        "donors": all_donors,
        "recipients": all_recipients,
        "drivers": all_drivers,
        "donations": all_donations,
        "matches": all_matches,
        "dispatch_events": all_events,
        "records": all_records,
    }

def seed_supabase_api(data: dict):
    """Seed data into Supabase via REST PostgREST API with batch inserts."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[!] SUPABASE_URL or SUPABASE_KEY is missing in .env")
        return False

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
    }

    client = httpx.Client(timeout=30.0)

    tables_order = ["donors", "recipients", "drivers", "donations", "matches", "dispatch_events", "records"]

    print(f"[*] Connecting to Supabase: {SUPABASE_URL}")

    # First clean existing synthetic records cleanly
    print("[*] Cleaning previous synthetic data across tables...")
    for tbl in reversed(tables_order):
        try:
            r = client.delete(f"{SUPABASE_URL}/rest/v1/{tbl}?is_synthetic=eq.true", headers=headers)
        except Exception as e:
            print(f"    Notice on delete {tbl}: {e}")

    # Insert in correct foreign key order in chunks of 50
    for tbl in tables_order:
        items = data[tbl]
        chunk_size = 50
        print(f"[*] Seeding {len(items)} rows into '{tbl}'...")
        for i in range(0, len(items), chunk_size):
            chunk = items[i:i + chunk_size]
            url = f"{SUPABASE_URL}/rest/v1/{tbl}"
            res = client.post(url, headers=headers, json=chunk)
            if res.status_code not in (200, 201, 204):
                print(f"[!] Error inserting into {tbl}: HTTP {res.status_code} - {res.text}")
            else:
                print(f"    Inserted {min(i + chunk_size, len(items))}/{len(items)} in {tbl}")

    print("[OK] Supabase REST API seeding completed successfully!")
    return True

def generate_sql_file(data: dict, out_path: Path):
    """Generate self-contained SQL file for Supabase SQL Editor."""
    lines = [
        "-- ==========================================================================",
        "-- AaharSetu (आहारसेतु) Multi-City Complete Synthetic Network Seed",
        "-- Covers all 10 major Indian cities across 100 city areas",
        "-- ==========================================================================\n",
        "BEGIN;\n",
        "-- Remove existing synthetic records",
        "DELETE FROM records WHERE city_id IS NOT NULL;",
        "DELETE FROM dispatch_events WHERE city_id IS NOT NULL;",
        "DELETE FROM matches WHERE city_id IS NOT NULL;",
        "DELETE FROM donations WHERE is_synthetic = true OR city_id IS NOT NULL;",
        "DELETE FROM drivers WHERE is_synthetic = true OR city_id IS NOT NULL;",
        "DELETE FROM recipients WHERE is_synthetic = true OR city_id IS NOT NULL;",
        "DELETE FROM donors WHERE is_synthetic = true OR city_id IS NOT NULL;\n",
    ]

    # Donors
    lines.append("-- 1. DONORS")
    lines.append("INSERT INTO donors (id, city_id, name, type, area, latitude, longitude, contact, license_no, license_verified, is_synthetic) VALUES")
    donor_vals = []
    for d in data["donors"]:
        name_esc = d["name"].replace("'", "''")
        area_esc = d["area"].replace("'", "''")
        donor_vals.append(f"('{d['id']}', '{d['city_id']}', '{name_esc}', '{d['type']}', '{area_esc}', {d['latitude']}, {d['longitude']}, '{d['contact']}', '{d['license_no']}', {str(d['license_verified']).lower()}, true)")
    lines.append(",\n".join(donor_vals) + ";\n")

    # Recipients
    lines.append("-- 2. RECIPIENTS")
    lines.append("INSERT INTO recipients (id, city_id, name, area, latitude, longitude, capacity_kg, reserved_kg, accepts, need_level, open_hours, approved, is_open, reliability, is_synthetic) VALUES")
    recip_vals = []
    for r in data["recipients"]:
        name_esc = r["name"].replace("'", "''")
        area_esc = r["area"].replace("'", "''")
        recip_vals.append(f"('{r['id']}', '{r['city_id']}', '{name_esc}', '{area_esc}', {r['latitude']}, {r['longitude']}, {r['capacity_kg']}, {r['reserved_kg']}, '{r['accepts']}'::jsonb, {r['need_level']}, '{r['open_hours']}', {str(r['approved']).lower()}, {str(r['is_open']).lower()}, {r['reliability']}, true)")
    lines.append(",\n".join(recip_vals) + ";\n")

    # Drivers
    lines.append("-- 3. DRIVERS")
    lines.append("INSERT INTO drivers (id, city_id, name, latitude, longitude, availability, vehicle, capacity_kg, telegram_id, reliability, is_synthetic) VALUES")
    driver_vals = []
    for dr in data["drivers"]:
        name_esc = dr["name"].replace("'", "''")
        driver_vals.append(f"('{dr['id']}', '{dr['city_id']}', '{name_esc}', {dr['latitude']}, {dr['longitude']}, {str(dr['availability']).lower()}, '{dr['vehicle']}', {dr['capacity_kg']}, '{dr['telegram_id']}', {dr['reliability']}, true)")
    lines.append(",\n".join(driver_vals) + ";\n")

    # Donations
    lines.append("-- 4. DONATIONS")
    lines.append("INSERT INTO donations (id, city_id, donor_id, item, category, qty_kg, prepared_at, temp_c, safe_until, status, recipient_id, driver_id, raw_text, is_synthetic, created_at) VALUES")
    dn_vals = []
    for dn in data["donations"]:
        item_esc = dn["item"].replace("'", "''")
        raw_esc = dn["raw_text"].replace("'", "''")
        temp_val = str(dn["temp_c"]) if dn["temp_c"] is not None else "null"
        recip_val = f"'{dn['recipient_id']}'" if dn["recipient_id"] else "null"
        dr_val = f"'{dn['driver_id']}'" if dn["driver_id"] else "null"
        dn_vals.append(f"('{dn['id']}', '{dn['city_id']}', '{dn['donor_id']}', '{item_esc}', '{dn['category']}', {dn['qty_kg']}, '{dn['prepared_at']}', {temp_val}, '{dn['safe_until']}', '{dn['status']}', {recip_val}, {dr_val}, '{raw_esc}', true, '{dn['created_at']}')")
    lines.append(",\n".join(dn_vals) + ";\n")

    # Matches
    lines.append("-- 5. MATCHES")
    lines.append("INSERT INTO matches (id, city_id, donation_id, recipient_id, score, reasons, state) VALUES")
    m_vals = []
    for m in data["matches"]:
        m_vals.append(f"('{m['id']}', '{m['city_id']}', '{m['donation_id']}', '{m['recipient_id']}', {m['score']}, '{m['reasons']}'::jsonb, '{m['state']}')")
    lines.append(",\n".join(m_vals) + ";\n")

    # Dispatch Events
    lines.append("-- 6. DISPATCH EVENTS")
    lines.append("INSERT INTO dispatch_events (id, city_id, donation_id, driver_id, event_type, message, created_at) VALUES")
    e_vals = []
    for e in data["dispatch_events"]:
        msg_esc = e["message"].replace("'", "''")
        dr_val = f"'{e['driver_id']}'" if e["driver_id"] else "null"
        e_vals.append(f"('{e['id']}', '{e['city_id']}', '{e['donation_id']}', {dr_val}, '{e['event_type']}', '{msg_esc}', '{e['created_at']}')")
    lines.append(",\n".join(e_vals) + ";\n")

    # Records
    lines.append("-- 7. VERIFIED FSSAI DELIVERY RECORDS")
    lines.append("INSERT INTO records (id, city_id, donation_id, quantity_kg, temperature_c, area, delivered_at, consume_by) VALUES")
    rec_vals = []
    for rec in data["records"]:
        area_esc = rec["area"].replace("'", "''")
        temp_val = str(rec["temperature_c"]) if rec["temperature_c"] is not None else "null"
        rec_vals.append(f"('{rec['id']}', '{rec['city_id']}', '{rec['donation_id']}', {rec['quantity_kg']}, {temp_val}, '{area_esc}', '{rec['delivered_at']}', '{rec['consume_by']}')")
    lines.append(",\n".join(rec_vals) + ";\n")

    lines.append("COMMIT;\n")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] Generated complete SQL seed file at: {out_path} ({len(lines)} lines)")

def main():
    print("=" * 60)
    print("  AaharSetu Multi-City Synthetic Data Seeder")
    print("  Generating synthetic nodes for 10 cities x 10 areas")
    print("=" * 60)

    data = generate_multi_city_data()
    print(f"[+] Generated:")
    print(f"    - {len(data['donors'])} Donors across 100 areas")
    print(f"    - {len(data['recipients'])} Recipients / Shelters")
    print(f"    - {len(data['drivers'])} Volunteer Drivers")
    print(f"    - {len(data['donations'])} Active Countdown Donations")
    print(f"    - {len(data['matches'])} Algorithmic Route Matches")
    print(f"    - {len(data['dispatch_events'])} Dispatch Audit Events")
    print(f"    - {len(data['records'])} Verified Delivery Records")

    # Write SQL seed file
    sql_path = ROOT_DIR / "supabase" / "seed_multicity.sql"
    generate_sql_file(data, sql_path)

    # Save shared JSON cache for client & offline fallback
    json_path = ROOT_DIR / "shared" / "multicity_seed.json"
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"[OK] Saved JSON seed cache at: {json_path}")

    # Seed Supabase via REST API
    seed_supabase_api(data)

    print("\n[SUCCESS] All city areas now have complete synthetic data in the database!")

if __name__ == "__main__":
    main()
