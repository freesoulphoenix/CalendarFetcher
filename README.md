# CALENDAR FETCHER
Is a custom Adobe Illustrator CEP extension that generates a full 12-month calendar layout directly in Illustrator — with optional public holidays, flexible styling, and clean layer structure.
Designed for designers who want print-ready calendars without manual layout pain.

## ✨ Features
1. Generate a full year calendar (12 months) in Illustrator
2. 2×6 layout (configurable)
3. Each month is created as a separate top-level layer
4. Two render styles:
    - Grid style: boxed calendar with lines
    - No-grid style: clean, minimalist layout with centered dates
5. Optional public holiday fetching (via Nager.Date API)
6. Holiday names are not inside date cells  
    → displayed only as a legend below each month
7. Sunday & public holidays in red
8. Works without holidays (for future years like 2027+)

## 🧩 Folder Structure
calendar-fetcher/  
├─ client/
│  ├─ index.html        # CEP panel UI  
│  ├─ index.js          # Panel logic (fetch, UI, CSInterface bridge)  
│  ├─ style.css  
│  └─ CSInterface.js  
│  
├─ host/  
│  └─ index.jsx         # Illustrator ExtendScript (calendar generator)  
│  
├─ manifest.xml  
└─ README.md  

## 🖥 Requirements
- Adobe Illustrator (tested with modern CC versions)
- CEP enabled (standard for Illustrator CC)
- Internet connection (optional, only for fetching holidays)

## 🚀 Installation
1. Clone or download the repository
2. Install as a CEP extension
Copy the project folder to your CEP extensions directory:  
    macOS  
    ~/Library/Application Support/Adobe/CEP/extensions/  
    Windows  
    C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\  
You may need to enable unsigned extensions during development.

## 🧪 Development Mode (Recommended)
Enable CEP debugging:  
    macOS  
    defaults write com.adobe.CSXS.11 PlayerDebugMode 1  
    Windows  
    [HKEY_CURRENT_USER\Software\Adobe\CSXS.11]  
    "PlayerDebugMode"="1"  
Restart Illustrator afterward.  

## 🧭 How to Use
1. Open Adobe Illustrator
2. Open the panel:
   Window → Extensions → Calendar Fetcher
3. Choose:
    Country (optional, for holidays)
    Year
    Style:
    Style 1 — Grid
    Style 2 — No grid
4. Click Generate Calendar  
🎉 _You’ll get 12 top-level layers, one per month._


## 🛠 Tech Stack
- Adobe CEP (HTML / CSS / JS)
- Illustrator ExtendScript (JSX)
- CSInterface bridge
- Nager.Date Public Holiday API
