<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/images/logo-dark.png">
    <img src="assets/images/logo-light.png" alt="UIUCalc logo" width="120">
  </picture>
</p>

<!-- <h1 align="center">UIUCalc</h1> -->

<p align="center">
  UIUCalc --- A fast, minimal academic toolkit for UIU students: CGPA, tuition fees, target planning and exam clash checking in one place.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/JSON-000000?style=for-the-badge&logo=json&logoColor=white" alt="JSON">
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel">
</p>

---

## Table of Contents

- [Project Overview](#project-overview)
- [Project Objective](#project-objective)
- [How to Run This Project](#how-to-run-this-project)
- [Project File Structure](#project-file-structure)
- [Conclusion](#conclusion)
- [License](#license)

---

## Project Overview

UIUCalc is a free, lightweight web application that brings the everyday numbers of a university trimester into one clean interface. It runs entirely in the browser: there is no account to create, no server to maintain and nothing to install.

It includes four tools:

| Tool | What it does |
| --- | --- |
| **CGPA Calculator** | Enter your completed credits and current CGPA, add new and retake courses, and see your updated CGPA, the change from your current one, your term GPA and your total credits. Includes the full UIU grading scale, which can be saved as an image or a CSV file. |
| **Tuition Fee Calculator** | Estimates the gross fee, itemized waiver and scholarship deductions, the net payable amount and the three installments. Covers retakes, FYDP and thesis credits, special waivers and late registration. |
| **Target CGPA Planner** | Shows the GPA you need to reach a target CGPA over the next trimester, several trimesters or until graduation, plus a what-if mode and a suggested grade mix. |
| **Exam Conflict Tracker** | Pick your courses and sections to see exam clashes on a day-by-slot grid. Same-slot clashes are flagged as critical conflicts and heavy exam days as pressure warnings. |

Other highlights:

- Responsive layout that adapts to phones, tablets, laptops and large screens
- Light and dark themes, with a logo that follows the active theme
- Collapsible sidebar and a mobile navigation drawer
- Your last-used inputs, name and preferences are saved on your own device
- Accessible forms, keyboard navigation and reduced-motion support

## Project Objective

- Give UIU students one fast, reliable place for their academic calculations.
- Remove manual arithmetic and the mistakes that come with it.
- Help students plan ahead: set a CGPA target, estimate fees and check exam clashes before advising.
- Keep the tools simple, private and free to use, with every calculation running locally in the browser.
- Make the project easy to maintain: grade scales, fee rules and exam schedules are kept in plain, editable files.

## How to Run This Project

### Live website

> **Live Demo:** [Paste your Vercel app link here](https://uiucalc-shahriar.vercel.app/)

### Run locally with VS Code

The site must be opened through a local server, so do not open `index.html` by double-clicking it.

1. Download or clone this repository and unzip it if needed.
2. Open **VS Code**, choose **File > Open Folder**, and select the `UIUCalc` folder that contains `index.html`.
3. Open the **Extensions** panel, search for **Live Server** (by Ritwick Dey) and click **Install**.
4. Right-click `index.html` in the Explorer panel and choose **Open with Live Server**, or click **Go Live** in the bottom-right corner.
5. Your browser opens the site, usually at `http://127.0.0.1:5500/`. All tools are ready to use.

> **Note:** An internet connection is needed for the web fonts. Without it the site still works, using fallback fonts.

## Project File Structure

```
UIUCalc/
├── index.html                      Landing page
├── 404.html                        Custom not-found page
├── changelog.html                  Release notes
├── calculator/
│   ├── cgpa/index.html             CGPA Calculator
│   ├── tuition-fee/index.html      Tuition Fee Calculator
│   └── cgpa-planner/index.html     Target CGPA Planner
├── tools/
│   └── exam-conflict-tracker/index.html   Exam Conflict Tracker
├── assets/
│   ├── css/                        Design tokens, layout, components, animations, page styles
│   ├── js/
│   │   ├── config/                 Grading scale and fee rules (editable)
│   │   ├── lib/                    Calculation logic, formatting, storage, validation
│   │   ├── components/             Sidebar, header, theme, toasts, animated counters
│   │   ├── pages/                  One script per page
│   │   └── main.js                 Shared startup logic
│   ├── icons/sprite.svg            Icon set
│   └── images/                     Logos (light and dark), favicons, social preview
├── data/
│   └── exam-schedule.json          Exam schedule data, updated each trimester
├── tests/                          Automated tests for the calculation logic
├── package.json                    Project metadata
├── vercel.json                     Hosting configuration
├── robots.txt
├── sitemap.xml
├── LICENSE
└── README.md
```

### Keeping the data up to date

| What to update | File |
| --- | --- |
| Exam schedule for a new trimester | `data/exam-schedule.json` |
| Grade scale and credit options | `assets/js/config/grading.js` |
| Fee rates, waivers and installment rules | `assets/js/config/fees.js` |

## Conclusion

UIUCalc turns the most common academic questions of a trimester into quick, clear answers: where will my CGPA land, what will I pay, what GPA do I need, and will my exams clash. It works on any device, keeps your data on your own device, and is built to be easy to update as university rules and schedules change.

> **Disclaimer:** UIUCalc is an unofficial student project. Fee figures are estimates only, so please confirm final amounts with the university accounts office.

## License

This project is licensed under the **MIT License**.

Copyright (c) 2026 **Shahriar Hossain**

See the [LICENSE](LICENSE) file for details.
