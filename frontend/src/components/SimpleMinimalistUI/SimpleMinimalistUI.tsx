'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { NavPage, Alert } from '@/types';
import { MOCK_CITIES } from '@/data/mockData';
import { getAlertsData } from '@/lib/api';
import styles from './SimpleMinimalistUI.module.css';

interface SimpleMinimalistUIProps {
  selectedCity: string;
  onSelectCity: (city: string) => void;
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  onSwitchAtmosphere: () => void;
  renderOtherPage?: () => React.ReactNode;
}

export function SimpleMinimalistUI({
  selectedCity = 'Kanpur',
  onSelectCity,
  currentPage = 'overview',
  onNavigate,
  onSwitchAtmosphere,
  renderOtherPage,
}: SimpleMinimalistUIProps) {
  // Accessibility & Localization States
  const [fontSize, setFontSize] = useState<'14px' | '16px' | '19px'>('16px');
  const [dataTheme, setDataTheme] = useState<'light' | 'dark'>('light');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Fetch real alerts for selected city
  useEffect(() => {
    let mounted = true;
    getAlertsData(selectedCity)
      .then((a) => {
        if (mounted && a) setAlerts(a);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [selectedCity]);

  // Set font size on root html element
  useEffect(() => {
    document.documentElement.style.fontSize = fontSize;
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [fontSize]);

  // Sync data-theme attribute
  const toggleTheme = () => {
    const nextTheme = dataTheme === 'dark' ? 'light' : 'dark';
    setDataTheme(nextTheme);
  };

  // Find Current City Meta (State)
  const currentCityMeta = useMemo(() => {
    const found = MOCK_CITIES.find(c => c.city.toLowerCase() === selectedCity.toLowerCase());
    return found || {
      city: selectedCity,
      state: 'Uttar Pradesh',
    };
  }, [selectedCity]);

  const severeAlert = alerts.find(a => a.type === 'danger' || a.type === 'warning');

  // Translations
  const isHi = language === 'hi';
  const t = {
    skip: isHi ? 'मुख्य सामग्री पर जाएं' : 'Skip to main content',
    ministry: isHi ? 'भारत सरकार · पृथ्वी विज्ञान मंत्रालय' : 'Government of India · Ministry of Earth Sciences',
    brandTitle: 'नभदृष्टि',
    brandSub: isHi
      ? 'नभदृष्टि · एआई–एनडब्ल्यूपी मौसम पूर्वानुमान सम्मिश्रण प्रणाली · MoES / NCMRWF'
      : 'NabhDrishti · AI–NWP Forecast Blending System · MoES / NCMRWF',
    navOverview: isHi ? 'अवलोकन' : 'Overview',
    navForecast: isHi ? 'पूर्वानुमान' : 'Forecast',
    navRpi: isHi ? 'जोखिम प्राथमिकता सूचकांक' : 'Risk Priority Index',
    navModels: isHi ? 'मॉडल' : 'Models',
    navExtreme: isHi ? 'चरम मौसम' : 'Extreme Weather',
    navPerf: isHi ? 'प्रदर्शन' : 'Performance',
    navHealth: isHi ? 'डेटा स्थिति' : 'Data Status',
    crumbHome: isHi ? 'होम' : 'Home',
    viewThresholds: isHi ? 'सीमाएं देखें' : 'View thresholds',
    noSevere: isHi
      ? 'अगले 72 घंटों में किसी गंभीर मौसम की संभावना नहीं है'
      : 'No severe weather expected in the next 72 hours',
    noSevereSub: isHi
      ? `${selectedCity} नारंगी और लाल चेतावनी सीमा से नीचे है। जोखिम संभावना: 5%।`
      : `${selectedCity} stays below Orange and Red alert thresholds. Hazard probability: 5%.`,
    disclaimer: isHi
      ? 'स्मार्ट इंडिया हैकाथॉन 2026 (PS 202681) हेतु संकल्पना डिजाइन। प्रतीक चिन्ह सांकेतिक है; आधिकारिक उपयोग हेतु भारत सरकार के अनुमोदित प्रतीक चिन्ह की आवश्यकता होगी।'
      : 'Concept design for Smart India Hackathon 2026 (PS 202681). Emblem is a placeholder; official use requires approved Government of India emblem assets. Real-time data synchronized with live AI-NWP blending engine.',
    atmoSwitch: isHi ? 'वातावरण मोड' : 'Atmosphere View',
  };

  const pageNames: Record<NavPage, { en: string; hi: string }> = {
    overview: { en: 'Overview', hi: 'अवलोकन' },
    forecast: { en: 'Forecast', hi: 'पूर्वानुमान' },
    rpi: { en: 'Risk Priority Index (RPI)', hi: 'जोखिम प्राथमिकता सूचकांक (RPI)' },
    'model-intelligence': { en: 'Models', hi: 'मॉडल' },
    'extreme-weather': { en: 'Extreme Weather', hi: 'चरम मौसम' },
    'model-performance': { en: 'Performance', hi: 'प्रदर्शन' },
    'data-health': { en: 'Data Status', hi: 'डेटा स्थिति' },
  };

  const currentPageTitle = isHi
    ? pageNames[currentPage]?.hi || pageNames.overview.hi
    : pageNames[currentPage]?.en || pageNames.overview.en;

  return (
    <div className={styles.container} data-theme={dataTheme}>
      {/* 0. Accessibility Skip Link */}
      <a className={styles.skip} href="#content">
        {t.skip}
      </a>

      {/* 1. Tricolor Top Ribbon */}
      <div className={styles.tri} aria-hidden="true" />

      {/* 2. Government Utility Bar */}
      <div className={styles.util}>
        <div className={styles.utilInner}>
          <div className={styles.utilLeft}>
            <span>{t.ministry}</span>
          </div>

          <div className={styles.utilControls}>
            {/* Text Resizing Controls */}
            <button
              type="button"
              onClick={() => setFontSize('14px')}
              className={`${styles.utilBtn} ${fontSize === '14px' ? styles.utilBtnActive : ''}`}
              aria-label="Decrease text size"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize('16px')}
              className={`${styles.utilBtn} ${fontSize === '16px' ? styles.utilBtnActive : ''}`}
              aria-label="Normal text size"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSize('19px')}
              className={`${styles.utilBtn} ${fontSize === '19px' ? styles.utilBtnActive : ''}`}
              aria-label="Increase text size"
            >
              A+
            </button>

            {/* High-Contrast / Theme Toggle */}
            <button
              id="th"
              type="button"
              onClick={toggleTheme}
              className={styles.utilBtn}
              aria-label="Toggle theme contrast"
              title="Toggle theme contrast"
            >
              Theme: {dataTheme === 'light' ? 'Light' : 'Contrast'}
            </button>

            {/* Return to Cinematic Atmospheric Sky View */}
            <button
              type="button"
              onClick={onSwitchAtmosphere}
              className={styles.utilBtn}
              style={{ borderColor: 'var(--saf)', color: '#ffd29d', fontWeight: 600 }}
              title="Switch to 3D Atmospheric Sky & Glassmorphic View"
            >
              <span>🌌 {t.atmoSwitch}</span>
            </button>

            {/* Hindi / English Toggle */}
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className={styles.utilBtn}
              aria-label="Switch language"
            >
              {language === 'en' ? 'हिन्दी' : 'English'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Brand Header */}
      <header className={styles.mainHeader}>
        <div className={styles.brand}>
          {/* Emblem: Circle with Satyameva Jayate text */}
          <div className={styles.emb} aria-hidden="true" title="Government of India Emblem">
            सत्यमेव<br />जयते
          </div>

          <div className={styles.logoSep} aria-hidden="true" />

          {/* Official NabhDrishti Logo */}
          <div className={styles.logoWrap}>
            <img
              src="/logo-emblem.png"
              alt="नभदृष्टि NabhDrishti Logo"
              className={styles.logoImg}
            />
          </div>

          <div className={styles.brandInfo}>
            <h1 className={styles.brandTitle}>{t.brandTitle}</h1>
            <p className={styles.brandSub}>{t.brandSub}</p>
          </div>
        </div>
      </header>

      {/* 4. Primary Government Navigation Bar */}
      <nav className={styles.nav} aria-label="Primary Navigation">
        <ul className={styles.navList}>
          <li>
            <button
              type="button"
              onClick={() => onNavigate('overview')}
              className={styles.navLink}
              aria-current={currentPage === 'overview' ? 'page' : undefined}
            >
              {t.navOverview}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onNavigate('forecast')}
              className={styles.navLink}
              aria-current={currentPage === 'forecast' ? 'page' : undefined}
            >
              {t.navForecast}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onNavigate('rpi')}
              className={styles.navLink}
              aria-current={currentPage === 'rpi' ? 'page' : undefined}
            >
              {t.navRpi}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onNavigate('model-intelligence')}
              className={styles.navLink}
              aria-current={currentPage === 'model-intelligence' ? 'page' : undefined}
            >
              {t.navModels}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onNavigate('extreme-weather')}
              className={styles.navLink}
              aria-current={currentPage === 'extreme-weather' ? 'page' : undefined}
            >
              {t.navExtreme}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onNavigate('model-performance')}
              className={styles.navLink}
              aria-current={currentPage === 'model-performance' ? 'page' : undefined}
            >
              {t.navPerf}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onNavigate('data-health')}
              className={styles.navLink}
              aria-current={currentPage === 'data-health' ? 'page' : undefined}
            >
              {t.navHealth}
            </button>
          </li>
        </ul>
      </nav>

      {/* 5. Main Content Area */}
      <main id="content" className={styles.mainContent}>
        {/* Dynamic Government Breadcrumb */}
        <p className={styles.crumb}>
          {t.crumbHome} › {currentPageTitle} › {currentCityMeta.state} › {selectedCity}
        </p>

        {/* Status / Alert Banner */}
        <div
          className={styles.alert}
          role="status"
          data-severity={severeAlert ? (severeAlert.type === 'danger' ? 'danger' : 'warning') : 'normal'}
          style={{ marginBottom: '20px' }}
        >
          <div className={styles.alertText}>
            {severeAlert ? (
              <>
                <b>{severeAlert.title}</b>
                <span className={styles.alertSub}>
                  {selectedCity}, {currentCityMeta.state} · Window: {severeAlert.window}
                </span>
              </>
            ) : (
              <>
                <b>{t.noSevere}</b>
                <span className={styles.alertSub}>{t.noSevereSub}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('extreme-weather')}
            className={styles.alertBtn}
          >
            {t.viewThresholds}
          </button>
        </div>

        {/* 
          Render the COMPLETE feature functionality with all its maps, 
          graphs, comparison cards, metrics, and panels!
        */}
        {renderOtherPage ? renderOtherPage() : null}
      </main>

      {/* 6. Hackathon Project Note */}
      <p className={styles.note}>{t.disclaimer}</p>

      {/* 7. Government 3-Column Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <section className={styles.footerCol}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <img src="/logo-emblem.png" alt="नभदृष्टि Logo" style={{ height: '20px', width: 'auto' }} />
              <h3 style={{ margin: 0 }}>नभदृष्टि · NabhDrishti</h3>
            </div>
            <p>
              Ministry of Earth Sciences · National Centre for Medium Range Weather Forecasting (NCMRWF)
              <br />
              Smart India Hackathon 2026 (Problem Statement ID: 26081)
            </p>
          </section>

          <section className={styles.footerCol}>
            <h3>Information</h3>
            <ul>
              <li><a href="#help" onClick={(e) => e.preventDefault()}>Help &amp; Documentation</a></li>
              <li><a href="#a11y" onClick={(e) => e.preventDefault()}>Accessibility Statement</a></li>
              <li><a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Use</a></li>
              <li><a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a></li>
            </ul>
          </section>

          <section className={styles.footerCol}>
            <h3>Contact &amp; Operations</h3>
            <ul>
              <li><a href="#feedback" onClick={(e) => e.preventDefault()}>EOC Feedback Desk</a></li>
              <li><a href="#data" onClick={(e) => e.preventDefault()}>Data Access Request</a></li>
              <li><a href="#policies" onClick={(e) => e.preventDefault()}>Website Policies</a></li>
            </ul>
          </section>
        </div>

        <div className={styles.footerBottom}>
          <span>© 2026 Ministry of Earth Sciences (MoES), Government of India. All rights reserved.</span>
          <span>Designed for SIH 2026 · AI–NWP Blending Platform</span>
        </div>
      </footer>
    </div>
  );
}

export default SimpleMinimalistUI;
