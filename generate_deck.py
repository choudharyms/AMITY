import os
import sys
import shutil

sys.stdout.reconfigure(encoding='utf-8')

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

DOWNLOADS_DIR = r"C:\Users\madhusudan\Downloads"
PROJECT_DIR = r"c:\Users\madhusudan\Downloads\amityhacks"

SS1_PATH = os.path.join(DOWNLOADS_DIR, "ss1.png")
SS2_PATH = os.path.join(DOWNLOADS_DIR, "ss2.png")
SS3_PATH = os.path.join(DOWNLOADS_DIR, "ss3.png")
SS4_PATH = os.path.join(DOWNLOADS_DIR, "ss4.png")
if not os.path.exists(SS4_PATH):
    SS4_PATH = os.path.join(DOWNLOADS_DIR, "s4.png")

# Design Tokens (YC Pitch Deck Style)
COLOR_BG = RGBColor(0xFF, 0xFF, 0xFF)
COLOR_EMERALD = RGBColor(0x18, 0x6A, 0x4B)     # Brand forest green
COLOR_ACCENT_GREEN = RGBColor(0x10, 0xB9, 0x81)
COLOR_TEXT_PRIMARY = RGBColor(0x0F, 0x0F, 0x0F) # Charcoal / pitch black
COLOR_TEXT_MUTED = RGBColor(0x52, 0x52, 0x5B)   # Readable cool gray
COLOR_CARD_BG = RGBColor(0xFA, 0xFA, 0xFA)      # Soft card background
COLOR_CARD_BORDER = RGBColor(0xE4, 0xE4, 0xE7)  # Hairline border
COLOR_PILL_BG = RGBColor(0xEC, 0xFD, 0xF5)      # Light mint
COLOR_PILL_TEXT = RGBColor(0x06, 0x5F, 0x46)    # Dark emerald text
COLOR_DARK_PILL_BG = RGBColor(0x0F, 0x0F, 0x0F)
COLOR_DARK_PILL_TEXT = RGBColor(0xFF, 0xFF, 0xFF)
COLOR_STAT_BG = RGBColor(0xF0, 0xFD, 0xF4)
COLOR_HIGHLIGHT = RGBColor(0xDC, 0x26, 0x26)

FONT_NAME = "Helvetica Neue"
TOTAL_SLIDES = 10

def create_base_slide(prs, slide_idx):
    blank_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank_layout)
    
    # Background full fill
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = COLOR_BG
    bg.line.fill.background()
    
    # Left brand green accent bar
    stripe = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.22), prs.slide_height)
    stripe.fill.solid()
    stripe.fill.fore_color.rgb = COLOR_EMERALD
    stripe.line.fill.background()
    
    # Footer hairline divider
    divider = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.55), Inches(7.0), Inches(12.2), Inches(0.007))
    divider.fill.solid()
    divider.fill.fore_color.rgb = COLOR_CARD_BORDER
    divider.line.fill.background()
    
    # Footer Left
    tb_left = slide.shapes.add_textbox(Inches(0.55), Inches(7.03), Inches(4.5), Inches(0.35))
    tf_left = tb_left.text_frame
    tf_left.word_wrap = True
    p_left = tf_left.paragraphs[0]
    p_left.text = "AaharSetu  ·  आहारसेतु"
    p_left.font.name = FONT_NAME
    p_left.font.size = Pt(9.5)
    p_left.font.color.rgb = COLOR_TEXT_MUTED
    
    # Footer Center
    tb_mid = slide.shapes.add_textbox(Inches(4.5), Inches(7.03), Inches(5.0), Inches(0.35))
    tf_mid = tb_mid.text_frame
    tf_mid.word_wrap = True
    p_mid = tf_mid.paragraphs[0]
    p_mid.alignment = PP_ALIGN.CENTER
    p_mid.text = "amity-sandy-psi.vercel.app  ·  AMIHACKS 1.0 Track A"
    p_mid.font.name = FONT_NAME
    p_mid.font.size = Pt(9.5)
    p_mid.font.color.rgb = COLOR_TEXT_MUTED
    
    # Footer Right - Wider box so it never wraps
    tb_right = slide.shapes.add_textbox(Inches(10.8), Inches(7.03), Inches(1.9), Inches(0.35))
    tf_right = tb_right.text_frame
    tf_right.word_wrap = False
    p_right = tf_right.paragraphs[0]
    p_right.alignment = PP_ALIGN.RIGHT
    p_right.text = f"{slide_idx:02d} / {TOTAL_SLIDES:02d}"
    p_right.font.name = FONT_NAME
    p_right.font.size = Pt(9.5)
    p_right.font.color.rgb = COLOR_TEXT_MUTED
    
    return slide

def add_header(slide, tag_text, title_text, subtitle_text=None, top_inch=0.42):
    # Pill Tag
    tag_width = Inches(max(1.8, len(tag_text) * 0.125))
    tag_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.65), Inches(top_inch), tag_width, Inches(0.28))
    tag_box.fill.solid()
    tag_box.fill.fore_color.rgb = COLOR_PILL_BG
    tag_box.line.color.rgb = COLOR_PILL_BG
    p_tag = tag_box.text_frame.paragraphs[0]
    p_tag.text = tag_text
    p_tag.alignment = PP_ALIGN.CENTER
    p_tag.font.name = FONT_NAME
    p_tag.font.size = Pt(9)
    p_tag.font.bold = True
    p_tag.font.color.rgb = COLOR_PILL_TEXT
    
    # Title
    t_box = slide.shapes.add_textbox(Inches(0.65), Inches(top_inch + 0.32), Inches(12.0), Inches(0.55))
    t_frame = t_box.text_frame
    t_frame.word_wrap = True
    p_title = t_frame.paragraphs[0]
    p_title.text = title_text
    p_title.font.name = FONT_NAME
    p_title.font.size = Pt(22)
    p_title.font.bold = True
    p_title.font.color.rgb = COLOR_TEXT_PRIMARY
    
    # Subtitle
    if subtitle_text:
        s_box = slide.shapes.add_textbox(Inches(0.65), Inches(top_inch + 0.82), Inches(12.0), Inches(0.35))
        s_frame = s_box.text_frame
        s_frame.word_wrap = True
        p_sub = s_frame.paragraphs[0]
        p_sub.text = subtitle_text
        p_sub.font.name = FONT_NAME
        p_sub.font.size = Pt(11.5)
        p_sub.font.color.rgb = COLOR_TEXT_MUTED

def add_card(slide, left, top, width, height, title, subtitle=None, bullets=None, bg_color=COLOR_CARD_BG, border_color=COLOR_CARD_BORDER, align_left=True):
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    card.fill.solid()
    card.fill.fore_color.rgb = bg_color
    card.line.color.rgb = border_color
    card.line.width = Pt(1)
    
    tf = card.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.2)
    tf.margin_right = Inches(0.2)
    tf.margin_top = Inches(0.18)
    tf.margin_bottom = Inches(0.18)
    
    align = PP_ALIGN.LEFT if align_left else PP_ALIGN.CENTER
    
    # Title
    p_t = tf.paragraphs[0]
    p_t.text = title
    p_t.alignment = align
    p_t.font.name = FONT_NAME
    p_t.font.size = Pt(12.5)
    p_t.font.bold = True
    p_t.font.color.rgb = COLOR_TEXT_PRIMARY
    
    # Subtitle
    if subtitle:
        p_s = tf.add_paragraph()
        p_s.text = subtitle
        p_s.alignment = align
        p_s.font.name = FONT_NAME
        p_s.font.size = Pt(10)
        p_s.font.bold = True
        p_s.font.color.rgb = COLOR_EMERALD
        p_s.space_before = Pt(2)
        p_s.space_after = Pt(4)
    
    # Bullets
    if bullets:
        for b in bullets:
            p_b = tf.add_paragraph()
            p_b.text = f"• {b}"
            p_b.alignment = PP_ALIGN.LEFT
            p_b.font.name = FONT_NAME
            p_b.font.size = Pt(9.5)
            p_b.font.color.rgb = COLOR_TEXT_MUTED
            p_b.space_before = Pt(2.5)
            
    return card

def build_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    
    # =========================================================================
    # SLIDE 1: Title & Overview
    # =========================================================================
    s1 = create_base_slide(prs, 1)
    
    pill1 = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.65), Inches(1.1), Inches(1.7), Inches(0.35))
    pill1.fill.solid()
    pill1.fill.fore_color.rgb = COLOR_DARK_PILL_BG
    pill1.line.fill.background()
    p_p1 = pill1.text_frame.paragraphs[0]
    p_p1.text = "AMIHACKS 1.0"
    p_p1.alignment = PP_ALIGN.CENTER
    p_p1.font.name = FONT_NAME
    p_p1.font.size = Pt(10)
    p_p1.font.bold = True
    p_p1.font.color.rgb = COLOR_DARK_PILL_TEXT
    
    pill2 = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(2.5), Inches(1.1), Inches(2.9), Inches(0.35))
    pill2.fill.solid()
    pill2.fill.fore_color.rgb = COLOR_PILL_BG
    pill2.line.fill.background()
    p_p2 = pill2.text_frame.paragraphs[0]
    p_p2.text = "Track A · NGO / Social Impact"
    p_p2.alignment = PP_ALIGN.CENTER
    p_p2.font.name = FONT_NAME
    p_p2.font.size = Pt(10)
    p_p2.font.bold = True
    p_p2.font.color.rgb = COLOR_PILL_TEXT
    
    tb_univ = s1.shapes.add_textbox(Inches(9.2), Inches(1.1), Inches(3.5), Inches(0.35))
    p_univ = tb_univ.text_frame.paragraphs[0]
    p_univ.text = "Amity University Rajasthan"
    p_univ.alignment = PP_ALIGN.RIGHT
    p_univ.font.name = FONT_NAME
    p_univ.font.size = Pt(11)
    p_univ.font.color.rgb = COLOR_TEXT_MUTED
    
    # Big Title
    tb_title = s1.shapes.add_textbox(Inches(0.65), Inches(1.7), Inches(10.0), Inches(1.4))
    tf_title = tb_title.text_frame
    p_t1 = tf_title.paragraphs[0]
    p_t1.text = "AaharSetu"
    p_t1.font.name = FONT_NAME
    p_t1.font.size = Pt(68)
    p_t1.font.bold = True
    p_t1.font.color.rgb = COLOR_TEXT_PRIMARY
    
    p_t2 = tf_title.add_paragraph()
    p_t2.text = "आहारसेतु"
    p_t2.font.name = FONT_NAME
    p_t2.font.size = Pt(28)
    p_t2.font.color.rgb = COLOR_EMERALD
    
    # Divider
    div = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.65), Inches(3.4), Inches(11.8), Inches(0.015))
    div.fill.solid()
    div.fill.fore_color.rgb = COLOR_TEXT_PRIMARY
    div.line.fill.background()
    
    # Subtitle
    tb_sub = s1.shapes.add_textbox(Inches(0.65), Inches(3.55), Inches(11.8), Inches(0.7))
    p_sub = tb_sub.text_frame.paragraphs[0]
    p_sub.text = "Real-Time Food Rescue Routing & Safety Network for Indian Cities"
    p_sub.font.name = FONT_NAME
    p_sub.font.size = Pt(20)
    p_sub.font.bold = True
    p_sub.font.color.rgb = COLOR_TEXT_PRIMARY
    
    p_sub2 = tb_sub.text_frame.add_paragraph()
    p_sub2.text = "Connecting banquet halls, restaurants, and caterers to verified shelters in under 5 minutes with AI intake, FSSAI countdowns, and cryptographic handover."
    p_sub2.font.name = FONT_NAME
    p_sub2.font.size = Pt(12.5)
    p_sub2.font.color.rgb = COLOR_TEXT_MUTED
    p_sub2.space_before = Pt(6)
    
    # 4 Bottom Core Capability Badges
    cap_data = [
        ("AI-Powered Intake", "Google Gemini Flash-Lite parses unstructured Hindi & English messages in < 2 seconds"),
        ("FSSAI Safety Engine", "Per-category countdown timers (2–6h) with automated hard dispatch locks"),
        ("5-Factor Matching", "Transparent mathematical ranking: Urgency, Proximity, Need, Capacity & Reliability"),
        ("Chain of Custody", "Dual QR/OTP verification with immutable audit logs stored in PostGIS")
    ]
    card_w = Inches(2.82)
    card_gap = Inches(0.18)
    for i, (ct, cd) in enumerate(cap_data):
        c_left = Inches(0.65) + i * (card_w + card_gap)
        c = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c_left, Inches(4.7), card_w, Inches(1.85))
        c.fill.solid()
        c.fill.fore_color.rgb = COLOR_CARD_BG
        c.line.color.rgb = COLOR_CARD_BORDER
        c.line.width = Pt(1)
        
        tf = c.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.2)
        tf.margin_right = Inches(0.2)
        tf.margin_top = Inches(0.2)
        
        pt = tf.paragraphs[0]
        pt.text = ct
        pt.alignment = PP_ALIGN.LEFT
        pt.font.name = FONT_NAME
        pt.font.size = Pt(12)
        pt.font.bold = True
        pt.font.color.rgb = COLOR_TEXT_PRIMARY
        
        pd = tf.add_paragraph()
        pd.text = cd
        pd.alignment = PP_ALIGN.LEFT
        pd.font.name = FONT_NAME
        pd.font.size = Pt(9.5)
        pd.font.color.rgb = COLOR_TEXT_MUTED
        pd.space_before = Pt(5)

    # =========================================================================
    # SLIDE 2: Problem Statement (Required Deliverable)
    # =========================================================================
    s2 = create_base_slide(prs, 2)
    add_header(s2, "01 · PROBLEM STATEMENT", "The Hunger Paradox: Abundance vs. The 2-to-6-Hour Window", 
               "India wastes 78 million tonnes of food annually while 194 million people go hungry. The gap is not food—it is coordination.")
    
    stat_metrics = [
        ("78M Tonnes", "Food Wasted Annually in India", "UNEP Food Waste Index 2024"),
        ("194M People", "Sleep Hungry Every Night", "Global Hunger Index 2025"),
        ("₹1.55 Lakh Cr", "Economic Value Wasted Annually", "National Food Rescue Deficit"),
        ("2 to 6 Hours", "Acute Edible Safety Window", "FSSAI Mandatory Limits")
    ]
    stat_w = Inches(2.82)
    stat_gap = Inches(0.18)
    for i, (s_val, s_lbl, s_src) in enumerate(stat_metrics):
        s_left = Inches(0.65) + i * (stat_w + stat_gap)
        sc = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, s_left, Inches(1.85), stat_w, Inches(1.3))
        sc.fill.solid()
        sc.fill.fore_color.rgb = COLOR_STAT_BG if i != 0 else RGBColor(0xFE, 0xF2, 0xF2)
        sc.line.color.rgb = COLOR_CARD_BORDER
        sc.line.width = Pt(1)
        
        tf = sc.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.18)
        tf.margin_top = Inches(0.15)
        
        p1 = tf.paragraphs[0]
        p1.text = s_val
        p1.font.name = FONT_NAME
        p1.font.size = Pt(20)
        p1.font.bold = True
        p1.font.color.rgb = COLOR_HIGHLIGHT if i == 0 else COLOR_EMERALD
        
        p2 = tf.add_paragraph()
        p2.text = s_lbl
        p2.font.name = FONT_NAME
        p2.font.size = Pt(9.5)
        p2.font.bold = True
        p2.font.color.rgb = COLOR_TEXT_PRIMARY
        
        p3 = tf.add_paragraph()
        p3.text = s_src
        p3.font.name = FONT_NAME
        p3.font.size = Pt(8.5)
        p3.font.color.rgb = COLOR_TEXT_MUTED
    
    causes = [
        ("Phone Calls & WhatsApp Chaos", "Coordination takes 1–2 hours", [
            "Donors broadcast across informal WhatsApp groups with no standard format.",
            "Manual phone triage delays response while food sits at room temperature.",
            "By the time a driver responds, the critical edible window has closed."
        ]),
        ("Zero Food Safety Countdown", "Nobody enforces FSSAI 2–6h windows", [
            "Cooked hot food spoils after 4 hours; cooked ambient perishes in 2 hours.",
            "No existing platform tracks elapsed prep time or road travel buffer.",
            "Distributing compromised food causes illness and severe liability for shelters."
        ]),
        ("Zero Audit Trail & Proof of Custody", "High legal liability for donors", [
            "No verifiable record of who prepared, transported, or received the food.",
            "Commercial donors fear regulatory fines under FSSAI Surplus Regulations 2019.",
            "Result: Restaurants dump edible surplus into landfills rather than risk liability."
        ])
    ]
    cause_w = Inches(3.82)
    cause_gap = Inches(0.2)
    for i, (c_t, c_s, c_b) in enumerate(causes):
        c_left = Inches(0.65) + i * (cause_w + cause_gap)
        add_card(s2, c_left, Inches(3.35), cause_w, Inches(3.35), c_t, c_s, c_b)

    # =========================================================================
    # SLIDE 3: Proposed Solution (Required Deliverable)
    # =========================================================================
    s3 = create_base_slide(prs, 3)
    add_header(s3, "02 · PROPOSED SOLUTION", "AaharSetu: The Real-Time Food Rescue Bridge",
               "Connecting surplus food donors to verified shelters in under 5 minutes with mathematical safety and routing guarantees.")
    
    solution_pillars = [
        ("Multilingual AI Intake Engine", "Powered by Google Gemini Flash-Lite", [
            "Eliminates complex forms: Donors send audio or plain text in Hindi or English.",
            "Instant entity extraction: Automatically structures food type, kg, temperature, and preparation timestamp in < 2 seconds.",
            "Zero PII transmission: Only dietary quantity and food category sent to the AI model."
        ]),
        ("FSSAI Food Safety Countdown Engine", "Regulatory-Compliant Safety Enforcer", [
            "Automated countdown timers based on FSSAI Surplus Food Regulations 2019.",
            "Strict categories: Hot-hold (4 hr), Cooked ambient (2 hr), Cold-chain (6 hr).",
            "Automated Hard Block: Dispatch engine automatically cancels/locks missions if road ETA exceeds safe consumption limit."
        ]),
        ("Explainable 5-Factor Matching", "Deterministic, Multi-Objective Ranking", [
            "Score = 0.35 × Urgency + 0.25 × Proximity + 0.20 × Need + 0.10 × Capacity + 0.10 × Reliability.",
            "Transparent breakdown: Coordinators see exact mathematical scoring for every shelter.",
            "Prevents volunteer bias and ensures the most vulnerable shelters receive high-protein meals first."
        ]),
        ("Cryptographic Chain of Custody", "Dual QR & OTP Handover Verification", [
            "Stage 1 (Pickup): Volunteer scans dynamic donor QR code to accept legal custody.",
            "Stage 2 (Dropoff): Shelter manager validates delivery via one-time 6-digit OTP.",
            "Immutable audit ledger stored in Supabase PostGIS; complete protection under Good Samaritan clauses."
        ])
    ]
    grid_w = Inches(5.82)
    grid_h = Inches(2.45)
    for i, (p_t, p_s, p_b) in enumerate(solution_pillars):
        row = i // 2
        col = i % 2
        c_left = Inches(0.65) + col * (grid_w + Inches(0.25))
        c_top = Inches(1.85) + row * (grid_h + Inches(0.2))
        add_card(s3, c_left, c_top, grid_w, grid_h, p_t, p_s, p_b)

    # =========================================================================
    # SLIDE 4: System Architecture (Required Deliverable)
    # =========================================================================
    s4 = create_base_slide(prs, 4)
    add_header(s4, "03 · SYSTEM ARCHITECTURE", "Production-Grade Microservices & Geospatial Architecture",
               "Modular, deterministic, and built for sub-second fail-safe coordination across Indian cities.")
    
    arch_layers = [
        ("Layer 1 · Presentation & Client", "React 19 + TypeScript + Vite", [
            "MapLibre GL Vector Map: High-performance rendering of live nodes, routes, and volunteer vehicles.",
            "Tailwind CSS & Radix UI: Responsive layout with light/dark theme support.",
            "Role-Based Dashboards: Dedicated UX for Coordinators, Donors, Drivers, and Shelters.",
            "Real-time SWR Client: Instant state hydration without stale cache anomalies."
        ]),
        ("Layer 2 · Backend Engines", "FastAPI Core Microservices", [
            "FSSAI Countdown Engine: Real-time perishable timer tracking with safety lockouts.",
            "5-Factor Scorer: Deterministic multi-criteria ranking algorithm.",
            "VRP Route Optimizer: OpenRouteService integration with 2-opt heuristic vs greedy baseline.",
            "Async Task Pipeline: Immediate trigger processing and dispatch event distribution."
        ]),
        ("Layer 3 · AI & Spatial Services", "Gemini AI & Road Networks", [
            "Google Gemini Flash-Lite: Multilingual entity extraction & safety classification from raw text/audio.",
            "OpenRouteService (ORS): Road network distance matrices, traffic-aware durations & turn geometry.",
            "Haversine Fallback Engine: Zero-downtime offline geographic distance computations."
        ]),
        ("Layer 4 · Database & Security", "Supabase PostgreSQL + PostGIS", [
            "PostGIS Geospatial Indexing: ST_DWithin queries across 10 Indian pilot cities.",
            "Row-Level Security (RLS): Strict multi-tenant role authorization per user tier.",
            "Realtime WebSockets: Live publication of active mission coordinates & milestones.",
            "Cryptographic Audit Ledger: Immutable handover timestamps and OTP signature logs."
        ])
    ]
    arch_w = Inches(2.82)
    arch_gap = Inches(0.18)
    for i, (a_t, a_s, a_b) in enumerate(arch_layers):
        a_left = Inches(0.65) + i * (arch_w + arch_gap)
        add_card(s4, a_left, Inches(1.85), arch_w, Inches(4.85), a_t, a_s, a_b)

    # =========================================================================
    # SLIDE 5: Operational Workflow — Step-by-Step
    # =========================================================================
    s5 = create_base_slide(prs, 5)
    add_header(s5, "04 · OPERATIONAL WORKFLOW", "From Surplus Signal to Shelter in 4 Deterministic Steps",
               "Automating the complete lifecycle from donation notification to verified shelter distribution under 5 minutes.")
    
    steps = [
        ("01 · POST", "Surplus Signal Intake", [
            "Donor posts surplus details in plain English or Hindi text/voice.",
            "Gemini AI structures quantity, food tier, storage temperature, and expiry window.",
            "Listing immediately appears on Coordinator mission control board."
        ]),
        ("02 · MATCH", "5-Factor Algorithmic Ranking", [
            "FastAPI evaluates all active shelters in radius within milliseconds.",
            "Calculates weighted composite score (Urgency, Proximity, Need, Capacity, Reliability).",
            "Coordinator approves match with full visibility into ranking metrics."
        ]),
        ("03 · ROUTE", "VRP Multi-Stop Optimization", [
            "OpenRouteService computes optimized multi-stop road route.",
            "Capacity-aware dispatch pairs mission with nearest vehicle (Auto, Van, or Bike).",
            "Driver receives turn-by-turn route and safe arrival deadline countdown."
        ]),
        ("04 · DELIVER", "Dual Cryptographic Handover", [
            "Driver scans donor's dynamic QR code to take legal custody.",
            "Shelter enters 6-digit OTP verification upon food dropoff.",
            "PostGIS ledger updates impact metrics (kg rescued, CO₂e avoided, water saved)."
        ])
    ]
    step_w = Inches(2.82)
    step_gap = Inches(0.18)
    for i, (st_num, st_title, st_bullets) in enumerate(steps):
        s_left = Inches(0.65) + i * (step_w + step_gap)
        add_card(s5, s_left, Inches(1.85), step_w, Inches(3.6), st_num, st_title, st_bullets)
        
    hl_box = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.65), Inches(5.65), Inches(11.8), Inches(1.05))
    hl_box.fill.solid()
    hl_box.fill.fore_color.rgb = COLOR_CARD_BG
    hl_box.line.color.rgb = COLOR_CARD_BORDER
    hl_tf = hl_box.text_frame
    hl_tf.word_wrap = True
    hl_tf.margin_left = Inches(0.25)
    hl_tf.margin_top = Inches(0.18)
    
    p_hl1 = hl_tf.paragraphs[0]
    p_hl1.text = "Operational Guarantees & Speed Benchmarks"
    p_hl1.alignment = PP_ALIGN.LEFT
    p_hl1.font.name = FONT_NAME
    p_hl1.font.size = Pt(12.5)
    p_hl1.font.bold = True
    p_hl1.font.color.rgb = COLOR_EMERALD
    
    p_hl2 = hl_tf.add_paragraph()
    p_hl2.text = "⚡ < 5 min from donation post to driver dispatch  ·  🛡️ 100% FSSAI compliance with automated safety lockouts  ·  📍 10 Indian cities pre-configured (Bengaluru, Mumbai, Delhi + 7 more)"
    p_hl2.alignment = PP_ALIGN.LEFT
    p_hl2.font.name = FONT_NAME
    p_hl2.font.size = Pt(11)
    p_hl2.font.color.rgb = COLOR_TEXT_PRIMARY
    p_hl2.space_before = Pt(4)

    # =========================================================================
    # SLIDE 6: Demo Screenshots — Mission Control & Fleet (Required Deliverable)
    # =========================================================================
    s6 = create_base_slide(prs, 6)
    add_header(s6, "05 · DEMO SCREENSHOTS (1/2)", "Live Operations: Mission Control & Fleet Dispatch",
               "Real-time geospatial dispatch board and capacity-aware volunteer fleet coordination.")
    
    # Left Column: ss1.png (Coordinator Dashboard)
    # ss1 is 1365 x 598 -> ratio 2.28. If height = 2.50 in, width = 5.71 in
    s6.shapes.add_picture(SS1_PATH, Inches(0.65), Inches(1.75), height=Inches(2.50))
    add_card(s6, Inches(0.65), Inches(4.45), Inches(5.8), Inches(2.35),
             "Coordinator Command Center (Bengaluru Network)",
             "Live MapLibre GL Visualization & Real-Time Telemetry", [
                 "24 active nodes: Donors, Shelters, and Volunteer Drivers on dynamic vector map.",
                 "Real-time KPI metrics: 35 kg food rescued, 63 meals enabled, 87.5 kg CO₂e avoided.",
                 "Live 'On the ground' activity timeline tracking pickup, matching, and deliveries."
             ])
    
    # Right Column: ss4.png (Volunteer Drivers Fleet)
    # ss4 is 1078 x 588 -> ratio 1.83. If height = 2.50 in, width = 4.58 in
    s6.shapes.add_picture(SS4_PATH, Inches(6.85), Inches(1.75), height=Inches(2.50))
    add_card(s6, Inches(6.85), Inches(4.45), Inches(5.8), Inches(2.35),
             "Capacity-Aware Volunteer Fleet Management",
             "Multi-Modal Payload Tracking & Live Mission Status", [
                 "Vehicle payload limits: Auto Rickshaws (60 kg), Eco Vans (100 kg), Bikes (25 kg).",
                 "Dynamic mission status tracking: Available, On a rescue, Matched, and In transit.",
                 "Synthetic volunteer labels providing 100% transparency for hackathon evaluation."
             ])

    # =========================================================================
    # SLIDE 7: Demo Screenshots — Chain of Custody & Ecological Impact (Required Deliverable)
    # =========================================================================
    s7 = create_base_slide(prs, 7)
    add_header(s7, "06 · DEMO SCREENSHOTS (2/2)", "Live Operations: Chain of Custody & Ecological Ledger",
               "Cryptographic handover verification and verifiable environmental impact reporting.")
    
    # Left: ss2.png (466 x 576 -> ratio 0.81)
    # Height = Inches(4.9) -> Width = Inches(3.96)
    s7.shapes.add_picture(SS2_PATH, Inches(0.65), Inches(1.75), height=Inches(4.9))
    
    # Right Top Card: Explanation of Custody
    add_card(s7, Inches(4.85), Inches(1.75), Inches(7.7), Inches(1.5),
             "Cryptographic Chain of Custody (FSSAI 2019 Compliant)",
             "Dual-Factor Verification: QR Code + 6-Digit OTP Fallback", [
                 "Stage 1 (Pickup Verification): Courier scans QR to accept custody from donor.",
                 "Stage 2 (Shelter Delivery): Recipient verifies handover with cryptographically generated OTP.",
                 "Legal Immunity: Full digital audit pass eliminates donor liability under Good Samaritan guidelines."
             ])
    
    # Right Middle: ss3.png (1081 x 588 -> ratio 1.838)
    # Width = Inches(7.7) -> Height = Inches(4.18) is too tall.
    # If height = Inches(2.45) -> Width = Inches(4.5)
    s7.shapes.add_picture(SS3_PATH, Inches(4.85), Inches(3.40), height=Inches(2.3))
    
    # Right Bottom Card: Ecological Ledger Callout
    add_card(s7, Inches(4.85), Inches(5.85), Inches(7.7), Inches(0.95),
             "Verified Ecological Impact Ledger",
             "Live Environmental Offsets Computed from Verified Deliveries", [
                 "38 kg food saved (68 meals)  ·  95.0 kg CO₂e landfill emissions avoided  ·  144,400 L virtual water conserved"
             ])

    # =========================================================================
    # SLIDE 8: Hackathon Integrity & Technical Milestones
    # =========================================================================
    s8 = create_base_slide(prs, 8)
    add_header(s8, "07 · VERIFICATION & INTEGRITY", "Zero Fake Outputs: Engineering Integrity & Verification",
               "Every metric, route, and decision in AaharSetu is mathematically computed and live.")
    
    milestones = [
        ("No Hardcoded Results", "Computed Live On-Demand", [
            "All road distances, durations, and multi-stop sequences are computed via Haversine and OpenRouteService.",
            "No pre-baked coordinates, fake timers, or static responses."
        ]),
        ("Synthetic Data Transparency", "Visible Audit Badges", [
            "All simulated pilot data points carry an explicit 'Synthetic' badge in the UI.",
            "Judges can independently inspect and test data without confusion."
        ]),
        ("Zero PII to AI", "Privacy-Preserving Architecture", [
            "Gemini receives only food descriptions, quantities, and temperatures.",
            "No donor contact details, phone numbers, or addresses ever touch external LLMs."
        ]),
        ("Explainable AI Decisions", "Transparent 5-Factor Math", [
            "Every NGO match displays the exact mathematical breakdown of the 5 weighted scoring factors.",
            "Zero black-box decisions or hidden algorithms."
        ]),
        ("100% Open Source Stack", "Permissive & Auditable", [
            "Built on FastAPI (MIT), Supabase JS (MIT), MapLibre GL (BSD-3), and Google GenAI SDK (Apache-2.0).",
            "Complete license attribution documented in repository."
        ]),
        ("Live Production Deployment", "Fully Operational & Testable", [
            "Hosted live at amity-sandy-psi.vercel.app with complete role workflows.",
            "Tested for cross-browser responsiveness and sub-second endpoint responses."
        ])
    ]
    m_w = Inches(3.82)
    m_h = Inches(2.25)
    for i, (m_t, m_s, m_b) in enumerate(milestones):
        row = i // 3
        col = i % 3
        c_left = Inches(0.65) + col * (m_w + Inches(0.2))
        c_top = Inches(1.85) + row * (m_h + Inches(0.2))
        add_card(s8, c_left, c_top, m_w, m_h, m_t, m_s, m_b)

    # =========================================================================
    # SLIDE 9: Future Scope & Roadmap (Required Deliverable)
    # =========================================================================
    s9 = create_base_slide(prs, 9)
    add_header(s9, "08 · FUTURE SCOPE", "Future Scope & Roadmap: Scaling to National Infrastructure",
               "A structured 4-horizon expansion plan to transition from hackathon proof-of-concept to nationwide public utility.")
    
    horizons = [
        ("Horizon 1 · IoT Cold Chain", "Q1–Q2 · Hardware Telemetry", [
            "Integration with low-cost BLE temperature sensors placed in volunteer thermal bags.",
            "Automated continuous temperature logging to ensure uninterrupted HACCP compliance during transit.",
            "Dynamic driver rerouting if container temperature crosses safety thresholds."
        ]),
        ("Horizon 2 · Predictive Surplus AI", "Q2–Q3 · Proactive Positioning", [
            "Gemini models trained on municipal event calendars, banquet hall schedules, and wedding seasons.",
            "Predicts food surplus 3 hours before events end, pre-dispatching couriers to the vicinity.",
            "Reduces pickup latency from 5 minutes down to under 60 seconds."
        ]),
        ("Horizon 3 · Carbon Credit Tokens", "Q3–Q4 · Sustainable ESG Economy", [
            "Automated certification of avoided methane (CO₂e) and virtual water savings into auditable carbon credits.",
            "Enables corporate donors (hotels, caterers) to claim verifiable ESG tax offsets under Section 80G.",
            "Creates sustainable micro-stipends for volunteer delivery drivers."
        ]),
        ("Horizon 4 · Pan-India Expansion", "Year 1 · Public Sector Integration", [
            "Scaling from 10 pilot cities to 50+ tier-1 and tier-2 urban agglomerations across India.",
            "Direct integration with India's Smart Cities Mission and municipal food recovery programs.",
            "Open APIs for Swiggy, Zomato Feeding India, and Robin Hood Army integrations."
        ])
    ]
    h_w = Inches(2.82)
    h_gap = Inches(0.18)
    for i, (h_t, h_s, h_b) in enumerate(horizons):
        h_left = Inches(0.65) + i * (h_w + h_gap)
        add_card(s9, h_left, Inches(1.85), h_w, Inches(4.85), h_t, h_s, h_b)

    # =========================================================================
    # SLIDE 10: Conclusion & Presentation Summary
    # =========================================================================
    s10 = create_base_slide(prs, 10)
    add_header(s10, "09 · CONCLUSION & SUMMARY", "From Surplus to Service, Before Food Expires",
               "A complete, FSSAI-compliant, real-time rescue infrastructure engineered for national impact.")
    
    # Left Card: Project Links & Submission Overview
    add_card(s10, Inches(0.65), Inches(1.85), Inches(5.8), Inches(3.6),
             "Project Links & Submission Information", "AMIHACKS 1.0 Track A (NGO / Social Impact)", [
                 "Live Web Platform: amity-sandy-psi.vercel.app",
                 "GitHub Repository: github.com/omprakashjaat1306/AMITY",
                 "Regulatory Standard: FSSAI Surplus Food Regulations 2019",
                 "Database & GIS: Supabase PostgreSQL + PostGIS (Spatial indexing)",
                 "Backend Microservices: FastAPI (FSSAI engine, 5-factor scoring, VRP)",
                 "Frontend: React 19 + TypeScript + Vite + MapLibre GL",
                 "AI & LLM Services: Google Gemini Flash-Lite (Multilingual intake)"
             ])
    
    # Right Card: Deliverables Verification Checklist
    add_card(s10, Inches(6.65), Inches(1.85), Inches(5.8), Inches(3.6),
             "Presentation Deliverables Compliance Checklist", "100% Complete & Verifiable", [
                 "✔ PPT / PDF Deck: Clean YC style, exactly 10 slides (maximum 8–10 slides).",
                 "✔ Problem Statement: 78M tonne waste paradox & 2–6 hr safety gap (Slide 2).",
                 "✔ Proposed Solution: Multilingual AI + FSSAI engine + 5-factor match (Slide 3).",
                 "✔ System Architecture: Full 4-tier stack from MapLibre to PostGIS (Slide 4).",
                 "✔ Demo Screenshots: Real operational proof with ss1, ss2, ss3, ss4 (Slides 6 & 7).",
                 "✔ Future Scope: IoT sensors, predictive ML & carbon credit roadmap (Slide 9)."
             ])
    
    # Bottom Strip: Summary Impact Counters
    b_counters = [
        ("78M Tonnes", "Food Waste Addressed"),
        ("< 5 Minutes", "Intake to Dispatch"),
        ("10 Cities", "Live Pre-Configured"),
        ("100% Traceable", "Cryptographic Chain"),
        ("Zero Fake Outputs", "Engineered for Real")
    ]
    b_w = Inches(2.24)
    b_gap = Inches(0.15)
    for i, (b_val, b_lbl) in enumerate(b_counters):
        b_left = Inches(0.65) + i * (b_w + b_gap)
        bc = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, b_left, Inches(5.65), b_w, Inches(1.05))
        bc.fill.solid()
        bc.fill.fore_color.rgb = COLOR_CARD_BG
        bc.line.color.rgb = COLOR_CARD_BORDER
        bc.line.width = Pt(1)
        
        tf = bc.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.15)
        tf.margin_top = Inches(0.12)
        
        p1 = tf.paragraphs[0]
        p1.text = b_val
        p1.font.name = FONT_NAME
        p1.font.size = Pt(14)
        p1.font.bold = True
        p1.font.color.rgb = COLOR_EMERALD
        
        p2 = tf.add_paragraph()
        p2.text = b_lbl
        p2.font.name = FONT_NAME
        p2.font.size = Pt(8.5)
        p2.font.color.rgb = COLOR_TEXT_MUTED
        p2.space_before = Pt(2)
        
    out_pptx_downloads = os.path.join(DOWNLOADS_DIR, "AaharSetu_YC_Style_Deck.pptx")
    out_pptx_project = os.path.join(PROJECT_DIR, "AaharSetu_YC_Style_Deck.pptx")
        
    prs.save(out_pptx_downloads)
    prs.save(out_pptx_project)
    print(f"Saved 10-slide YC deck to: {out_pptx_downloads}")
    print(f"Saved copy to: {out_pptx_project}")

if __name__ == "__main__":
    build_deck()
