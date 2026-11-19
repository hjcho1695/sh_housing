import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Info,
  Settings,
} from 'lucide-react';
import AdminPage from './components/AdminPage';
import {
  ADMIN_STORAGE_KEY,
  DEFAULT_ADMIN_RECORDS,
  DEFAULT_BASE_DATE,
  DEMO_PRESETS,
} from './data/defaultNotices';
import { AdminNoticeRecord, NoticeItem, NoticeStatus } from './types/notice';
import {
  buildGoogleCalendarUrl,
  buildTimeline,
  copyText,
  formatDateRangeDisplay,
  formatDotDate,
  formatTextField,
  getNoticeStatus,
  splitTextToDetailBoxes,
  stripToUserNotice,
} from './utils/noticeHelpers';
import { useScrollRevealGroup } from './hooks/useScrollReveal';

function normalizeAdminRecord(raw: Partial<AdminNoticeRecord>, fallbackId: number): AdminNoticeRecord {
  return {
    id: typeof raw.id === 'number' ? raw.id : fallbackId,
    name: typeof raw.name === 'string' ? raw.name : '',
    type: typeof raw.type === 'string' ? raw.type : '',
    noticeDate: typeof raw.noticeDate === 'string' ? raw.noticeDate : '',
    internetStart: typeof raw.internetStart === 'string' ? raw.internetStart : '',
    internetEnd: typeof raw.internetEnd === 'string' ? raw.internetEnd : '',
    visit: typeof raw.visit === 'string' ? raw.visit : '',
    docResultDate: typeof raw.docResultDate === 'string' ? raw.docResultDate : '',
    docSubmitStart: typeof raw.docSubmitStart === 'string' ? raw.docSubmitStart : '',
    docSubmitEnd: typeof raw.docSubmitEnd === 'string' ? raw.docSubmitEnd : '',
    winnerDate: typeof raw.winnerDate === 'string' ? raw.winnerDate : '',
    supply: typeof raw.supply === 'string' ? raw.supply : '',
    eligibility: typeof raw.eligibility === 'string' ? raw.eligibility : '',
    eligibilityItems: Array.isArray(raw.eligibilityItems) ? raw.eligibilityItems : undefined,
    points: typeof raw.points === 'string' ? raw.points : '',
    pointsItems: Array.isArray(raw.pointsItems) ? raw.pointsItems : undefined,
    documents: typeof raw.documents === 'string' ? raw.documents : '',
    documentItems: Array.isArray(raw.documentItems) ? raw.documentItems : undefined,
    caution: typeof raw.caution === 'string' ? raw.caution : '',
    cautionItems: Array.isArray(raw.cautionItems) ? raw.cautionItems : undefined,
    houseNo: typeof raw.houseNo === 'string' ? raw.houseNo : '',
    noticeUrl: typeof raw.noticeUrl === 'string' ? raw.noticeUrl : 'https://www.i-sh.co.kr/app/index.do',
    applyUrl: typeof raw.applyUrl === 'string' ? raw.applyUrl : 'https://www.i-sh.co.kr/app/index.do',
    reviewed: Boolean(raw.reviewed),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString().slice(0, 10),
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : {},
  };
}

function loadInitialAdminRecords(): AdminNoticeRecord[] {
  try {
    window.localStorage.removeItem('sh_subscription_admin_notices_v1');
    const raw = window.localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_RECORDS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item, idx) =>
        normalizeAdminRecord((item ?? {}) as Partial<AdminNoticeRecord>, idx + 1)
      );
    }
  } catch {
    // Fallback to defaults
  }
  return DEFAULT_ADMIN_RECORDS;
}

export default function App() {
  const [appMode, setAppMode] = useState<'user' | 'admin'>('user');
  const [adminRecords, setAdminRecords] = useState<AdminNoticeRecord[]>(
    loadInitialAdminRecords
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ADMIN_STORAGE_KEY,
        JSON.stringify(adminRecords)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [adminRecords]);

  const notices: NoticeItem[] = useMemo(
    () => adminRecords.map(stripToUserNotice),
    [adminRecords]
  );

  const [baseDate, setBaseDate] = useState<string>(DEFAULT_BASE_DATE);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<NoticeStatus>('open');

  const enrichedNotices = useMemo(() => {
    return notices.map((notice) => ({
      notice,
      ...getNoticeStatus(notice, baseDate),
    }));
  }, [notices, baseDate]);

  const counts = useMemo(() => {
    return {
      upcoming: enrichedNotices.filter((n) => n.status === 'upcoming').length,
      open: enrichedNotices.filter((n) => n.status === 'open').length,
      closed: enrichedNotices.filter((n) => n.status === 'closed').length,
    };
  }, [enrichedNotices]);

type DetailSectionKey =
  | 'eligibility'
  | 'points'
  | 'documents'
  | 'caution'
  | 'timeline'
  | 'checklist';

const DEFAULT_OPEN_SECTIONS: Record<DetailSectionKey, boolean> = {
  eligibility: true,
  points: true,
  documents: true,
  caution: true,
  timeline: true,
  checklist: true,
};

  const [copiedHouseKey, setCopiedHouseKey] = useState<string | null>(null);
  const [copiedSchedule, setCopiedSchedule] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isDemoBarOpen, setIsDemoBarOpen] = useState<boolean>(false);
  const [openSections, setOpenSections] = useState<Record<DetailSectionKey, boolean>>(
    DEFAULT_OPEN_SECTIONS
  );

  const toggleSection = (key: DetailSectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2000);
  };

  const visibleList = useMemo(
    () => enrichedNotices.filter((item) => item.status === activeTab),
    [enrichedNotices, activeTab]
  );

  const selectedItem = useMemo(
    () => enrichedNotices.find((item) => item.notice.id === selectedId) ?? null,
    [enrichedNotices, selectedId]
  );

  const revealKey = `${appMode}-${
    selectedItem
      ? `detail-${selectedItem.notice.id}`
      : `list-${activeTab}-${visibleList.map((v) => v.notice.id).join(',')}`
  }`;
  const { getRevealProps } = useScrollRevealGroup(revealKey);

  const handleSaveAdminRecord = (record: AdminNoticeRecord) => {
    setAdminRecords((prev) => {
      const exists = prev.some((r) => r.id === record.id);
      if (exists) {
        return prev.map((r) => (r.id === record.id ? record : r));
      }
      return [...prev, record];
    });
  };

  const handleDeleteAdminRecord = (id: number) => {
    setAdminRecords((prev) => prev.filter((r) => r.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleResetAdminDefaults = () => {
    setAdminRecords(DEFAULT_ADMIN_RECORDS);
  };

  const handleSelectNotice = (id: number) => {
    setSelectedId(id);
    setOpenSections(DEFAULT_OPEN_SECTIONS);
    setCopiedHouseKey(null);
    setCopiedSchedule(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleBackToList = () => {
    setSelectedId(null);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleOpenAdmin = () => {
    setAppMode('admin');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleBackToUser = () => {
    setAppMode('user');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleCopyHouseNo = async (key: string, valueToCopy: string) => {
    const ok = await copyText(valueToCopy);
    if (ok) {
      setCopiedHouseKey(key);
      showToast('주택관리번호가 복사되었습니다');
      window.setTimeout(() => setCopiedHouseKey(null), 2000);
    }
  };

  const handleCopySchedule = async (notice: NoticeItem) => {
    const summary = `[SH 청약] ${notice.name}\n접수기간: ${formatDateRangeDisplay(
      notice.internetStart,
      notice.internetEnd
    )}\n서류제출: ${formatDateRangeDisplay(
      notice.docSubmitStart,
      notice.docSubmitEnd
    )}\n신청 링크: ${notice.applyUrl}`;
    const ok = await copyText(summary);
    if (ok) {
      setCopiedSchedule(true);
      showToast('청약 일정이 복사되었습니다');
      window.setTimeout(() => setCopiedSchedule(false), 2000);
    }
  };

  const getKindBadgeClass = (type: string) => {
    if (type === '국민임대') return 'bg-[#efebff] text-[#7b5cff]';
    if (type === '장기전세') return 'bg-[#dff7f4] text-[#00a99d]';
    if (type === '행복주택') return 'bg-[#fff0e3] text-[#d95f00]';
    return 'bg-[#f2f4f7] text-[#555d66]';
  };

  if (appMode === 'admin') {
    return (
      <AdminPage
        records={adminRecords}
        onSaveRecord={handleSaveAdminRecord}
        onDeleteRecord={handleDeleteAdminRecord}
        onResetDefaults={handleResetAdminDefaults}
        onBackToUser={handleBackToUser}
      />
    );
  }

  const renderActionButtons = (variant: 'mobile' | 'desktop') => {
    if (!selectedItem) return null;
    const wrapperClass =
      variant === 'desktop'
        ? 'flex items-center gap-2 w-full'
        : 'flex items-center gap-2 max-w-6xl mx-auto w-full';

    if (selectedItem.status === 'upcoming') {
      const calendarUrl = buildGoogleCalendarUrl(selectedItem.notice);
      return (
        <div className={wrapperClass}>
          <button
            type="button"
            onClick={() => handleCopySchedule(selectedItem.notice)}
            className="flex-1 min-h-[42px] px-3 py-2 bg-[#eef3ff] hover:bg-[#e1ebff] text-[#2f6bff] border border-[#cfdeff] text-[13px] font-semibold rounded-[8px] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            {copiedSchedule ? (
              <>
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>복사됨</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 shrink-0" />
                <span>일정 복사</span>
              </>
            )}
          </button>

          {calendarUrl ? (
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-[2] min-h-[42px] px-4 py-2 bg-[#2f6bff] hover:bg-[#1e56e6] text-white text-[13.5px] font-bold rounded-[8px] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <CalendarPlus className="w-4 h-4 shrink-0" />
              <span>캘린더에 추가</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="flex-[2] min-h-[42px] px-4 py-2 bg-[#f2f4f7] text-[#8b95a1] text-[13.5px] font-bold rounded-[8px] cursor-not-allowed"
            >
              일정 미정
            </button>
          )}
        </div>
      );
    }

    if (selectedItem.status === 'open') {
      return (
        <div className={wrapperClass}>
          <a
            href={selectedItem.notice.noticeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-[42px] px-3 py-2 bg-white hover:bg-slate-50 text-[#1e1e23] border border-[#d5d9de] text-[13px] font-semibold rounded-[8px] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 shrink-0 text-[#555d66]" />
            <span>공고문</span>
          </a>
          <a
            href={selectedItem.notice.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-[2] min-h-[42px] px-4 py-2 bg-[#03c75a] hover:bg-[#029f48] text-white text-[13.5px] font-bold rounded-[8px] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <span>청약 신청하기</span>
            <ExternalLink className="w-4 h-4 shrink-0" />
          </a>
        </div>
      );
    }

    return (
      <div className={wrapperClass}>
        <button
          type="button"
          disabled
          className="flex-1 min-h-[42px] px-3 py-2 bg-[#f2f4f7] text-[#8b95a1] text-[13px] font-semibold rounded-[8px] cursor-not-allowed whitespace-nowrap"
        >
          접수 마감
        </button>
        <a
          href={selectedItem.notice.noticeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-[2] min-h-[42px] px-4 py-2 bg-[#eef3ff] hover:bg-[#e1ebff] text-[#2f6bff] border border-[#cfdeff] text-[13.5px] font-bold rounded-[8px] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>공고문 원문 보기</span>
        </a>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-[#1e1e23] overflow-x-clip">
      {/* 시연용 기준일 바 (하얀 바탕 · 검정/초록 글씨 · 접기/펼치기 가능) */}
      <div className="bg-white text-[#1e1e23] px-4 sm:px-6 lg:px-8 border-b border-[#e5e8eb]">
        <div className="max-w-5xl mx-auto">
          {!isDemoBarOpen ? (
            <div className="min-h-[36px] py-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[12px] text-[#1e1e23] min-w-0 truncate">
                <Calendar className="w-3.5 h-3.5 text-[#029f48] shrink-0" />
                <span className="truncate font-medium text-[#4e5968]">시연용 기준일</span>
                <span className="font-mono tabular-nums font-bold text-[#029f48] shrink-0">
                  {formatDotDate(baseDate)}
                </span>
              </div>

              <button
                type="button"
                aria-expanded={false}
                onClick={() => setIsDemoBarOpen(true)}
                className="h-[26px] px-2 bg-[#eefaf3] hover:bg-[#dcf5e6] text-[#029f48] border border-[#c7ebd6] text-[11px] font-semibold rounded-[6px] inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>기준일 변경</span>
                <ChevronDown className="w-3 h-3 shrink-0" />
              </button>
            </div>
          ) : (
            <div className="py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-start sm:items-center gap-1.5 text-[12px] text-[#1e1e23]">
                  <Calendar className="w-3.5 h-3.5 text-[#029f48] shrink-0 mt-0.5 sm:mt-0" />
                  <span className="leading-snug font-medium">
                    <strong className="font-bold text-[#029f48]">
                      시연용 기준일
                    </strong>{' '}
                    - 실제 서비스에서는 오늘 날짜로 자동 적용됩니다.
                  </span>
                </div>

                <button
                  type="button"
                  aria-expanded={true}
                  onClick={() => setIsDemoBarOpen(false)}
                  className="h-[26px] px-2 bg-[#f2f4f7] hover:bg-[#e5e8eb] text-[#1e1e23] border border-[#d5d9de] text-[11px] font-semibold rounded-[6px] inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>닫기</span>
                  <ChevronUp className="w-3 h-3 shrink-0" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="date"
                  aria-label="시연용 기준일"
                  value={baseDate}
                  onChange={(e) => {
                    if (e.target.value) setBaseDate(e.target.value);
                  }}
                  className="px-2.5 py-1 h-[34px] text-[12px] font-mono tabular-nums bg-[#f8fafc] text-[#1e1e23] rounded-[6px] border border-[#d5d9de] focus:outline-none focus:border-[#029f48]"
                />
                <div className="flex flex-wrap items-center gap-1">
                  {DEMO_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setBaseDate(preset.value)}
                      className={`px-2.5 py-1 h-[34px] text-[11.5px] font-semibold rounded-[6px] transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                        baseDate === preset.value
                          ? 'bg-[#029f48] text-white font-bold'
                          : 'bg-[#f2f4f7] text-[#333d4b] hover:bg-[#e8f9ef] hover:text-[#029f48]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상단 브랜드 헤더 (선택한 탭/공고 상태에 맞춰 색상 전환) */}
      <header
        className={`relative z-30 text-white transition-colors duration-200 ${
          (selectedItem ? selectedItem.status : activeTab) === 'upcoming'
            ? 'bg-gradient-to-br from-[#2f6bff] via-[#2459e8] to-[#1d4ed8]'
            : (selectedItem ? selectedItem.status : activeTab) === 'open'
              ? 'bg-gradient-to-br from-[#03c75a] via-[#00b86b] to-[#00a99d]'
              : 'bg-gradient-to-br from-[#64748b] via-[#57606a] to-[#475569]'
        } ${selectedItem ? 'sticky top-0 shadow-xs' : ''}`}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {selectedItem ? (
            <div className="h-12 flex items-center gap-2">
              <button
                type="button"
                onClick={handleBackToList}
                aria-label="공고 목록으로 돌아가기"
                className="inline-flex items-center gap-1.5 h-9 pr-3 text-[14.5px] font-bold text-white hover:opacity-85 transition-opacity cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>공고 상세 요약</span>
              </button>
            </div>
          ) : (
            <div className="py-3 sm:py-3.5 grid grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-1.5 sm:gap-y-0.5">
              <span className="row-start-1 col-start-1 sm:row-span-2 inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-[8px] bg-white p-1 shrink-0 overflow-hidden shadow-xs">
                <img
                  src="/assets/aistudio/image_901df9d5.png"
                  alt="SH 서울주택도시개발공사 공식 로고"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </span>

              <h1 className="row-start-1 col-start-2 min-w-0 text-[17px] sm:text-[18px] font-bold tracking-[-0.02em] text-white whitespace-nowrap leading-tight">
                SH 청약 비서
              </h1>

              <div className="row-start-1 col-start-3 sm:row-span-2 justify-self-end relative group">
                <a
                  href="https://www.i-sh.co.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[30px] sm:h-[32px] px-2.5 sm:px-3 bg-white/15 hover:bg-white/25 border border-white/30 text-white text-[11.5px] sm:text-[12px] font-semibold rounded-[8px] inline-flex items-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>공사 홈페이지</span>
                  <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                </a>

                <div
                  role="tooltip"
                  className="pointer-events-none absolute top-full right-0 mt-2.5 z-50 flex items-end gap-2 opacity-0 translate-y-1 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 transition-all duration-200"
                >
                  <img
                    src="/assets/aistudio/image_7376cbe3.png"
                    alt="SH 마스코트"
                    className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0 drop-shadow-[0_4px_10px_rgba(15,23,42,0.18)]"
                  />
                  <div className="relative bg-white border border-[#cce8d7] rounded-[14px] px-3.5 py-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.16)] w-[210px] sm:w-[238px] text-left">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[7px] bottom-4 w-3 h-3 bg-white border-l border-b border-[#cce8d7] rotate-45"
                    />
                    <p className="text-[11.5px] sm:text-[12px] font-medium text-[#191f28] leading-[1.48] break-keep">
                      <strong className="font-bold text-[#029f48]">
                        서울주택도시개발공사
                      </strong>
                      가 공급하는 임대·분양주택의 더 자세한 정보를 확인해 보세요!
                    </p>
                  </div>
                </div>
              </div>

              <p className="row-start-2 col-span-3 sm:col-span-1 sm:col-start-2 sm:row-start-2 text-[11.5px] sm:text-[12px] text-white/90 font-medium leading-snug break-keep">
                서울주택도시개발공사 · 청약 일정, 놓치지 않게 챙겨드릴게요
              </p>
            </div>
          )}
        </div>
      </header>

      {/* S1: 스티키 3색 언더라인 탭 */}
      {selectedItem === null && (
        <nav
          role="tablist"
          aria-label="공고 접수 상태"
          className="sticky top-0 z-20 bg-white border-b border-[#e5e8eb]"
        >
          <div className="max-w-5xl mx-auto grid grid-cols-3 md:flex md:gap-2 px-0 md:px-6 lg:px-8">
            {(
              [
                { id: 'upcoming', label: '청약 예정', count: counts.upcoming },
                { id: 'open', label: '접수 중', count: counts.open },
                { id: 'closed', label: '마감', count: counts.closed },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              const borderClass = isActive
                ? tab.id === 'upcoming'
                  ? 'border-b-[#2f6bff] text-[#191f28] font-bold'
                  : tab.id === 'open'
                    ? 'border-b-[#03c75a] text-[#191f28] font-bold'
                    : 'border-b-[#8b95a1] text-[#191f28] font-bold'
                : 'border-b-transparent text-[#8b95a1] hover:text-[#4e5968] font-medium';

              const countClass = isActive
                ? tab.id === 'upcoming'
                  ? 'bg-[#2f6bff] text-white'
                  : tab.id === 'open'
                    ? 'bg-[#03c75a] text-white'
                    : 'bg-[#8b95a1] text-white'
                : 'bg-[#f2f4f7] text-[#8b95a1]';

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-[44px] px-2 md:px-5 bg-white border-b-[2.5px] text-[13.5px] sm:text-[14px] transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${borderClass}`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[11px] font-bold font-mono tabular-nums ${countClass}`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* 본문 영역 */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 pb-8">
        {selectedItem === null ? (
          /* ================= S1: 공고 목록 ================= */
          <div className="space-y-4">
            {visibleList.length === 0 ? (
              <div className="bg-white border border-[#e5e8eb] rounded-[12px] px-6 py-14 text-center">
                <p className="text-[14px] font-medium text-[#8b95a1]">
                  해당하는 공고가 없어요.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {visibleList.map(({ notice, status, dDay }) => {
                  const supplyDisplay = formatTextField(notice.supply);
                  const periodDisplay = formatDateRangeDisplay(
                    notice.internetStart,
                    notice.internetEnd
                  );
                  const calendarUrl = buildGoogleCalendarUrl(notice);

                  const leftBarClass =
                    status === 'upcoming'
                      ? 'bg-[#2f6bff]'
                      : status === 'open'
                        ? 'bg-[#03c75a]'
                        : 'bg-[#c4c9d0]';

                  const cardReveal = getRevealProps(`card-${notice.id}`);

                  return (
                    <div
                      key={`${activeTab}-${notice.id}`}
                      ref={cardReveal.ref}
                      className={cardReveal.className}
                    >
                      <article
                        className="h-full relative overflow-hidden bg-white border border-[#e5e8eb] rounded-[12px] p-4 pl-5 flex flex-col justify-between gap-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] transition-shadow"
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute left-0 top-0 bottom-0 w-[4px] ${leftBarClass}`}
                        />

                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          {status === 'upcoming' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#e8efff] text-[#2f6bff] text-[11px] font-bold font-mono tabular-nums">
                              {dDay !== null ? `D-${dDay}` : '청약 예정'}
                            </span>
                          )}
                          {status === 'open' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#03c75a] text-white text-[11px] font-bold">
                              접수 중
                            </span>
                          )}
                          {status === 'closed' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#f2f4f7] text-[#8b95a1] text-[11px] font-bold">
                              접수 마감
                            </span>
                          )}

                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-bold ${getKindBadgeClass(
                              notice.type
                            )}`}
                          >
                            {notice.type}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectNotice(notice.id)}
                          className="text-left w-full group cursor-pointer"
                        >
                          <h2 className="text-[15px] font-bold text-[#191f28] group-hover:text-[#029f48] transition-colors leading-[1.42] tracking-[-0.015em] mb-2">
                            {notice.name}
                          </h2>
                        </button>

                        <ul className="space-y-1 text-[13px] text-[#4e5968] leading-[1.55]">
                          <li>
                            · 인터넷 접수:{' '}
                            <span className="font-mono tabular-nums font-semibold text-[#191f28]">
                              {periodDisplay}
                            </span>
                          </li>
                          <li>
                            · 방문 접수: {formatTextField(notice.visit).text}
                          </li>
                          <li>
                            · 공급 규모:{' '}
                            <span
                              className={
                                supplyDisplay.needsCheck
                                  ? 'text-amber-700 font-semibold'
                                  : 'text-[#191f28] font-medium'
                              }
                            >
                              {supplyDisplay.text}
                            </span>
                          </li>
                        </ul>
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleSelectNotice(notice.id)}
                          className="flex-1 min-h-[38px] px-3 py-2 bg-white hover:bg-[#f8fafc] text-[#333d4b] border border-[#d5d9de] text-[13px] font-semibold rounded-[8px] inline-flex items-center justify-center transition-colors whitespace-nowrap cursor-pointer"
                        >
                          요약 보기
                        </button>

                        {status === 'open' ? (
                          <a
                            href={notice.applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 min-h-[38px] px-3 py-2 bg-[#03c75a] hover:bg-[#029f48] text-white text-[13px] font-bold rounded-[8px] inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                          >
                            <span>청약 신청하기</span>
                          </a>
                        ) : status === 'upcoming' ? (
                          calendarUrl ? (
                            <a
                              href={calendarUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-h-[38px] px-3 py-2 bg-[#2f6bff] hover:bg-[#1e56e6] text-white text-[13px] font-bold rounded-[8px] inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                            >
                              <span>캘린더 추가</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSelectNotice(notice.id)}
                              className="flex-1 min-h-[38px] px-3 py-2 bg-[#eef3ff] text-[#2f6bff] border border-[#cfdeff] text-[13px] font-semibold rounded-[8px] inline-flex items-center justify-center whitespace-nowrap cursor-pointer"
                            >
                              일정 확인
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="flex-1 min-h-[38px] px-3 py-2 bg-[#f2f4f7] text-[#8b95a1] text-[13px] font-semibold rounded-[8px] cursor-not-allowed whitespace-nowrap"
                          >
                            접수 마감
                          </button>
                        )}
                      </div>
                    </article>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[11.5px] text-[#8b95a1] leading-relaxed pt-1">
              ※ 각 공고 카드는 SH 공식 모집공고문 데이터를 기반으로 구성되었으며, 상단 기준일에 따라 상태가 자동 전환됩니다.
            </p>
          </div>
        ) : (
          /* ================= S2: 공고 상세 ================= */
          <div key={selectedItem.notice.id} className="space-y-3 pb-24 lg:pb-4">
            <div className="bg-[#fff8eb] border border-[#fbe3b0] border-l-[4px] border-l-[#ff7a1a] rounded-[10px] px-3.5 py-2.5 text-[12.5px] text-[#4e5968] leading-relaxed flex items-center gap-2">
              <Info className="w-4 h-4 text-[#c2540a] shrink-0" />
              <p>
                <strong className="text-[#c2540a] font-bold">[참고 안내]</strong>{' '}
                요약은 참고용이며, 정확한 내용은 공고문을 확인하세요.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-4 items-start">
              {/* 왼쪽 메인 컬럼 */}
              <div className="lg:col-span-7 space-y-3">
                <section
                  ref={getRevealProps('detail-summary').ref}
                  className={`bg-white border border-[#e5e8eb] border-t-[4px] rounded-[12px] p-4 sm:p-5 space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${
                    selectedItem.status === 'upcoming'
                      ? 'border-t-[#2f6bff]'
                      : selectedItem.status === 'open'
                        ? 'border-t-[#03c75a]'
                        : 'border-t-[#9aa3ad]'
                  } ${getRevealProps('detail-summary').className}`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedItem.status === 'upcoming' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#e8efff] text-[#2f6bff] font-bold font-mono tabular-nums text-[11.5px]">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>
                          {selectedItem.dDay !== null
                            ? `D-${selectedItem.dDay}`
                            : '청약 예정'}
                        </span>
                      </span>
                    )}
                    {selectedItem.status === 'open' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#03c75a] text-white font-bold text-[11.5px]">
                        <Check className="w-3 h-3 shrink-0" />
                        <span>접수 중</span>
                      </span>
                    )}
                    {selectedItem.status === 'closed' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#f2f4f7] text-[#8b95a1] font-bold text-[11.5px]">
                        접수 마감
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11.5px] font-bold ${getKindBadgeClass(
                        selectedItem.notice.type
                      )}`}
                    >
                      {selectedItem.notice.type}
                    </span>
                  </div>

                  <h1 className="text-[17px] sm:text-[18.5px] font-bold text-[#191f28] leading-[1.38] tracking-[-0.02em]">
                    {selectedItem.notice.name}
                  </h1>

                  <div className="pt-2.5 border-t border-[#f2f4f7] grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-3 bg-[#f7f9fb] border border-[#e8ecf0] rounded-[8px] space-y-0.5">
                      <span className="block text-[11px] font-bold text-[#029f48]">
                        공급 규모
                      </span>
                      <p className="text-[13px] font-semibold text-[#191f28] leading-snug">
                        {formatTextField(selectedItem.notice.supply).text}
                      </p>
                    </div>
                    <div className="p-3 bg-[#f7f9fb] border border-[#e8ecf0] rounded-[8px] space-y-0.5">
                      <span className="block text-[11px] font-bold text-[#029f48]">
                        방문 접수
                      </span>
                      <p className="text-[13px] font-medium text-[#191f28] leading-snug">
                        {formatTextField(selectedItem.notice.visit).text}
                      </p>
                    </div>
                  </div>
                </section>

                {/* 신청자격 (접기/펼치기 가능, 기본 열림) */}
                <section
                  ref={getRevealProps('detail-eligibility').ref}
                  className={`bg-white border border-[#e5e8eb] rounded-[12px] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${getRevealProps('detail-eligibility').className}`}
                >
                  <button
                    type="button"
                    aria-expanded={openSections.eligibility}
                    onClick={() => toggleSection('eligibility')}
                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group"
                  >
                    <h2 className="flex items-center gap-2 text-[14.5px] font-bold text-[#191f28] tracking-[-0.01em]">
                      <span
                        aria-hidden="true"
                        className="w-[3px] h-[14px] rounded-[2px] bg-[#03c75a] shrink-0"
                      />
                      <span>신청자격</span>
                    </h2>
                    <ChevronDown
                      className={`w-4 h-4 text-[#8b95a1] group-hover:text-[#191f28] transition-transform duration-200 shrink-0 ${
                        openSections.eligibility ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openSections.eligibility && (
                    <div className="mt-3 pt-3 border-t border-[#f2f4f7] grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {splitTextToDetailBoxes(
                        selectedItem.notice.eligibility,
                        '신청자격',
                        selectedItem.notice.eligibilityItems
                      ).map((item, idx, arr) => (
                        <div
                          key={`${item.label}-${idx}`}
                          className={`p-3 bg-[#f4fbf7] border border-[#d6f0e1] rounded-[8px] space-y-0.5 ${
                            arr.length % 2 === 1 && idx === arr.length - 1
                              ? 'sm:col-span-2'
                              : ''
                          }`}
                        >
                          <span className="inline-block text-[11px] font-bold text-[#029f48]">
                            {item.label}
                          </span>
                          <p className="text-[13px] text-[#333d4b] leading-[1.55]">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 가점 · 선정기준 (접기/펼치기 가능, 기본 열림) */}
                <section
                  ref={getRevealProps('detail-points').ref}
                  className={`bg-white border border-[#e5e8eb] rounded-[12px] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${getRevealProps('detail-points').className}`}
                >
                  <button
                    type="button"
                    aria-expanded={openSections.points}
                    onClick={() => toggleSection('points')}
                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group"
                  >
                    <h2 className="flex items-center gap-2 text-[14.5px] font-bold text-[#191f28] tracking-[-0.01em]">
                      <span
                        aria-hidden="true"
                        className="w-[3px] h-[14px] rounded-[2px] bg-[#7b5cff] shrink-0"
                      />
                      <span>가점 · 선정기준</span>
                    </h2>
                    <ChevronDown
                      className={`w-4 h-4 text-[#8b95a1] group-hover:text-[#191f28] transition-transform duration-200 shrink-0 ${
                        openSections.points ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openSections.points && (
                    <div className="mt-3 pt-3 border-t border-[#f2f4f7] grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {splitTextToDetailBoxes(
                        selectedItem.notice.points,
                        '가점 · 기준',
                        selectedItem.notice.pointsItems
                      ).map((item, idx, arr) => (
                        <div
                          key={`${item.label}-${idx}`}
                          className={`p-3 bg-[#f8f7ff] border border-[#e5e0ff] rounded-[8px] space-y-0.5 ${
                            arr.length % 2 === 1 && idx === arr.length - 1
                              ? 'sm:col-span-2'
                              : ''
                          }`}
                        >
                          <span className="inline-block text-[11px] font-bold text-[#7b5cff]">
                            {item.label}
                          </span>
                          <p className="text-[13px] text-[#333d4b] leading-[1.55]">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 제출서류 (접기/펼치기 가능, 기본 열림) */}
                <section
                  ref={getRevealProps('detail-documents').ref}
                  className={`bg-white border border-[#e5e8eb] rounded-[12px] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${getRevealProps('detail-documents').className}`}
                >
                  <button
                    type="button"
                    aria-expanded={openSections.documents}
                    onClick={() => toggleSection('documents')}
                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group"
                  >
                    <h2 className="flex items-center gap-2 text-[14.5px] font-bold text-[#191f28] tracking-[-0.01em]">
                      <span
                        aria-hidden="true"
                        className="w-[3px] h-[14px] rounded-[2px] bg-[#00a99d] shrink-0"
                      />
                      <span>제출서류</span>
                    </h2>
                    <ChevronDown
                      className={`w-4 h-4 text-[#8b95a1] group-hover:text-[#191f28] transition-transform duration-200 shrink-0 ${
                        openSections.documents ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openSections.documents && (
                    <div className="mt-3 pt-3 border-t border-[#f2f4f7] grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {splitTextToDetailBoxes(
                        selectedItem.notice.documents,
                        '제출서류',
                        selectedItem.notice.documentItems
                      ).map((item, idx, arr) => (
                        <div
                          key={`${item.label}-${idx}`}
                          className={`p-3 bg-[#f2fbfa] border border-[#cdeee9] rounded-[8px] space-y-0.5 ${
                            arr.length % 2 === 1 && idx === arr.length - 1
                              ? 'sm:col-span-2'
                              : ''
                          }`}
                        >
                          <span className="inline-block text-[11px] font-bold text-[#008f85]">
                            {item.label}
                          </span>
                          <p className="text-[13px] text-[#333d4b] leading-[1.55]">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 놓치기 쉬운 사항 (접기/펼치기 가능, 기본 열림) */}
                <section
                  ref={getRevealProps('detail-caution').ref}
                  className={`bg-white border border-[#e5e8eb] rounded-[12px] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${getRevealProps('detail-caution').className}`}
                >
                  <button
                    type="button"
                    aria-expanded={openSections.caution}
                    onClick={() => toggleSection('caution')}
                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group"
                  >
                    <h2 className="flex items-center gap-2 text-[14.5px] font-bold text-[#191f28] tracking-[-0.01em]">
                      <span
                        aria-hidden="true"
                        className="w-[3px] h-[14px] rounded-[2px] bg-[#e5362b] shrink-0"
                      />
                      <AlertTriangle className="w-3.5 h-3.5 text-[#e5362b] shrink-0" />
                      <span>놓치기 쉬운 사항</span>
                    </h2>
                    <ChevronDown
                      className={`w-4 h-4 text-[#8b95a1] group-hover:text-[#191f28] transition-transform duration-200 shrink-0 ${
                        openSections.caution ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openSections.caution && (
                    <div className="mt-3 pt-3 border-t border-[#f2f4f7]">
                      {selectedItem.notice.cautionItems &&
                      selectedItem.notice.cautionItems.length > 0 ? (
                        <div className="space-y-2">
                          {selectedItem.notice.cautionItems.map((item) => (
                            <div
                              key={item.tag}
                              className="p-3 bg-[#fef2f1] border border-[#fbd7d4] rounded-[8px] space-y-0.5"
                            >
                              <span className="inline-block text-[11.5px] font-bold text-[#d93025]">
                                {item.tag}
                              </span>
                              <p className="text-[13px] text-[#333d4b] leading-[1.55]">
                                {item.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-[#fff8eb] border border-[#fbe3b0] rounded-[8px]">
                          <span className="inline-block text-[11.5px] font-bold text-[#c2540a] mb-0.5">
                            유의사항
                          </span>
                          <p className="text-[13px] text-[#333d4b] leading-[1.55]">
                            {formatTextField(selectedItem.notice.caution).text}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>

              {/* 오른쪽 타임라인 · 신청 전 확인 레일 */}
              <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-16">
                {/* 핵심 일정 타임라인 (접기/펼치기 가능, 기본 열림) */}
                <section
                  ref={getRevealProps('detail-timeline').ref}
                  className={`bg-white border border-[#e5e8eb] rounded-[12px] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${getRevealProps('detail-timeline').className}`}
                >
                  <button
                    type="button"
                    aria-expanded={openSections.timeline}
                    onClick={() => toggleSection('timeline')}
                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group"
                  >
                    <h2 className="flex items-center gap-2 text-[14.5px] font-bold text-[#191f28] tracking-[-0.01em]">
                      <span
                        aria-hidden="true"
                        className="w-[3px] h-[14px] rounded-[2px] bg-[#2f6bff] shrink-0"
                      />
                      <span>핵심 일정 타임라인</span>
                    </h2>
                    <ChevronDown
                      className={`w-4 h-4 text-[#8b95a1] group-hover:text-[#191f28] transition-transform duration-200 shrink-0 ${
                        openSections.timeline ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openSections.timeline && (
                    <ol className="mt-3 pt-3 border-t border-[#f2f4f7] space-y-0">
                      {buildTimeline(selectedItem.notice, baseDate).map(
                        (step, idx, arr) => {
                          const isLast = idx === arr.length - 1;
                          return (
                            <li key={step.key} className="relative pl-6 pb-4 last:pb-0">
                              {!isLast && (
                                <span
                                  aria-hidden="true"
                                  className="absolute left-[6px] top-3 bottom-0 w-0.5 bg-[#e5e8eb]"
                                />
                              )}
                              <span
                                aria-hidden="true"
                                className={`absolute left-[1.5px] top-[5px] w-2.5 h-2.5 rounded-full ${
                                  step.isNow
                                    ? 'bg-[#03c75a] ring-4 ring-[#e8f9ef]'
                                    : step.isPassed
                                      ? 'bg-[#cfd4da]'
                                      : 'bg-white border-2 border-[#cfd4da]'
                                }`}
                              />

                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`text-[13.5px] font-bold ${
                                    step.isNow
                                      ? 'text-[#029f48]'
                                      : step.isPassed
                                        ? 'text-[#8b95a1]'
                                        : 'text-[#191f28]'
                                  }`}
                                >
                                  {step.stepNo}. {step.label}
                                </span>
                                {step.isNow && (
                                  <span className="text-[11.5px] font-bold text-[#03c75a]">
                                    ← 지금
                                  </span>
                                )}
                              </div>

                              <p
                                className={`mt-0.5 text-[13px] font-mono tabular-nums ${
                                  step.dateText === '추후 공지'
                                    ? 'text-[#8b95a1] font-sans'
                                    : step.isNow
                                      ? 'text-[#191f28] font-semibold'
                                      : 'text-[#4e5968]'
                                }`}
                              >
                                {step.dateText}
                              </p>

                              {step.key === 'docSubmit' && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded-[4px] bg-[#fdecea] text-[#d93025] text-[11px] font-bold">
                                  등기우편 접수 · 일반우편 불가
                                </span>
                              )}
                              {step.key === 'winner' && (
                                <p className="mt-0.5 text-[11.5px] text-[#8b95a1]">
                                  금융자산 조회 일정에 따라 변경될 수 있습니다.
                                </p>
                              )}
                            </li>
                          );
                        }
                      )}
                    </ol>
                  )}
                </section>

                {/* 신청 전 확인하세요 (접기/펼치기 가능, 기본 열림) */}
                <section
                  ref={getRevealProps('detail-checklist').ref}
                  className={`bg-white border border-[#e5e8eb] rounded-[12px] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${getRevealProps('detail-checklist').className}`}
                >
                  <button
                    type="button"
                    aria-expanded={openSections.checklist}
                    onClick={() => toggleSection('checklist')}
                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group"
                  >
                    <h2 className="flex items-center gap-2 text-[14.5px] font-bold text-[#191f28] tracking-[-0.01em]">
                      <span
                        aria-hidden="true"
                        className="w-[3px] h-[14px] rounded-[2px] bg-[#ff7a1a] shrink-0"
                      />
                      <span>신청 전 확인하세요</span>
                    </h2>
                    <ChevronDown
                      className={`w-4 h-4 text-[#8b95a1] group-hover:text-[#191f28] transition-transform duration-200 shrink-0 ${
                        openSections.checklist ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openSections.checklist && (
                    <div className="mt-3 pt-3 border-t border-[#f2f4f7] space-y-3.5">
                      <div className="space-y-1.5">
                        <p className="text-[13px] font-bold text-[#191f28]">
                          청약홈 순위확인서 발급용 주택관리번호
                        </p>
                        <p className="text-[12px] text-[#4e5968]">
                          청약홈 순위확인서를 발급할 때 주택관리번호가 필요해요.
                        </p>

                        {(() => {
                          const houseNoInfo = formatTextField(
                            selectedItem.notice.houseNo
                          );
                          const entries = houseNoInfo.text
                            .split(/\s*\/\s*/)
                            .map((part) => {
                              const match = part.match(
                                /^([0-9-]+)\s*(?:\(([^)]+)\))?$/
                              );
                              return match
                                ? { code: match[1], note: match[2] ?? '' }
                                : { code: part, note: '' };
                            });

                          return (
                            <div className="space-y-1.5 pt-0.5">
                              {entries.map((entry, index) => {
                                const rowKey = `${selectedItem.notice.id}-${index}`;
                                const isCopied = copiedHouseKey === rowKey;
                                return (
                                  <div
                                    key={rowKey}
                                    className="flex items-center justify-between gap-2.5 px-3 py-2 bg-[#fff4ea] border border-[#ffe2c7] rounded-[8px]"
                                  >
                                    <div className="min-w-0">
                                      {entry.note && (
                                        <span className="block text-[11px] font-bold text-[#c2540a]/80">
                                          {entry.note}
                                        </span>
                                      )}
                                      <span
                                        className={`text-[14px] sm:text-[14.5px] font-bold font-mono tabular-nums tracking-wide break-all ${
                                          houseNoInfo.needsCheck
                                            ? 'text-amber-700 font-sans'
                                            : 'text-[#c2540a]'
                                        }`}
                                      >
                                        {entry.code}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCopyHouseNo(rowKey, entry.code)
                                      }
                                      className="h-[32px] px-2.5 bg-[#ff7a1a] hover:bg-[#e8690f] text-white text-[11.5px] font-bold rounded-[6px] inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                    >
                                      {isCopied ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 shrink-0" />
                                          <span>복사됐어요</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5 shrink-0" />
                                          <span>번호 복사</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="pt-2.5 border-t border-[#f2f4f7] space-y-1.5">
                        <p className="text-[13px] font-bold text-[#191f28]">
                          공고문 원본
                        </p>
                        <p className="text-[12px] text-[#4e5968] leading-relaxed">
                          단지·공급호수·소득·자산 기준 등 상세 내용은 SH 공식 공고문 게시물을 확인하세요.
                        </p>
                        <a
                          href={selectedItem.notice.noticeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[38px] w-full px-3.5 py-2 bg-[#eef3ff] hover:bg-[#e1ebff] text-[#2f6bff] border border-[#cfdeff] text-[13px] font-semibold rounded-[8px] inline-flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span>공고문 원문 보기</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      </div>
                    </div>
                  )}
                </section>

                <section
                  ref={getRevealProps('detail-calendar').ref}
                  className={`bg-white border border-[#e5e8eb] rounded-[12px] p-4 space-y-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${getRevealProps('detail-calendar').className}`}
                >
                  <h2 className="flex items-center gap-2 text-[14.5px] font-bold text-[#191f28] tracking-[-0.01em]">
                    <span
                      aria-hidden="true"
                      className="w-[3px] h-[14px] rounded-[2px] bg-[#03c75a] shrink-0"
                    />
                    <span>이 공고 일정 챙기기</span>
                  </h2>

                  <div className="bg-[#f4fbf7] border border-[#d6f0e1] rounded-[8px] p-3 space-y-2.5">
                    <p className="text-[12.5px] text-[#333d4b] leading-relaxed">
                      오늘 버전은 개인정보 없이 내 캘린더에 일정을 넣는 방식이에요. 문자 알림은 준비 중입니다.
                    </p>

                    {buildGoogleCalendarUrl(selectedItem.notice) && (
                      <a
                        href={buildGoogleCalendarUrl(selectedItem.notice)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] w-full px-3.5 py-2 bg-[#eef3ff] hover:bg-[#e1ebff] border border-[#cfdeff] text-[#2f6bff] text-[13px] font-semibold rounded-[8px] inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <CalendarPlus className="w-4 h-4 shrink-0" />
                        <span>구글 캘린더에 접수 시작일 담기</span>
                      </a>
                    )}
                  </div>
                </section>

                <div
                  ref={getRevealProps('detail-actions').ref}
                  className={`hidden lg:block bg-white border border-[#e5e8eb] rounded-[12px] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${getRevealProps('detail-actions').className}`}
                >
                  {renderActionButtons('desktop')}
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-[11.5px] text-[#8b95a1] leading-relaxed">
                본 화면은 공고문 이해를 돕기 위한 요약 정보이며, 신청 문의는 서울주택도시개발공사 콜센터(1600-3456) 또는 공식 공고문을 확인해 주세요.
              </p>

              <button
                type="button"
                onClick={handleBackToList}
                className="min-h-[40px] px-4 py-2 bg-white hover:bg-[#f8fafc] border border-[#d5d9de] text-[#191f28] text-[13px] font-bold rounded-[8px] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>공고 목록으로 돌아가기</span>
              </button>
            </div>
          </div>
        )}

        {/* 페이지 하단: 공사 홈페이지 · 관리자 페이지 이동 버튼 + 고정 안내 */}
        <footer
          className={`pt-6 pb-5 flex flex-col items-center gap-2.5 text-center text-[12px] text-[#8b95a1] ${
            selectedItem ? 'mb-20 lg:mb-0' : ''
          }`}
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="relative group">
              <a
                href="https://www.i-sh.co.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[36px] px-3.5 py-1.5 bg-white hover:bg-[#f8fafc] border border-[#d5d9de] text-[#333d4b] text-[12.5px] font-semibold rounded-[8px] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <span>서울주택도시개발공사 홈페이지 (i-sh.co.kr)</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#029f48]" />
              </a>

              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 flex items-end gap-2 opacity-0 translate-y-1 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 transition-all duration-200"
              >
                <img
                  src="/assets/aistudio/image_7376cbe3.png"
                  alt="SH 마스코트"
                  className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0 drop-shadow-[0_4px_10px_rgba(15,23,42,0.18)]"
                />
                <div className="relative bg-white border border-[#cce8d7] rounded-[14px] px-3.5 py-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.16)] w-[210px] sm:w-[240px] text-left">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[7px] bottom-4 w-3 h-3 bg-white border-l border-b border-[#cce8d7] rotate-45"
                  />
                  <p className="text-[11.5px] sm:text-[12px] font-medium text-[#191f28] leading-[1.48] break-keep">
                    <strong className="font-bold text-[#029f48]">
                      서울주택도시개발공사
                    </strong>
                    가 공급하는 임대·분양주택의 더 자세한 정보를 확인해 보세요!
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenAdmin}
              className="min-h-[36px] px-3.5 py-1.5 bg-white hover:bg-[#f8fafc] border border-[#d5d9de] text-[#333d4b] text-[12.5px] font-semibold rounded-[8px] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5 text-[#555d66]" />
              <span>관리자 페이지 (공고 등록 · 수정)</span>
            </button>
          </div>

          <p>이 페이지는 생성형 AI(Google AI Studio)를 활용해 제작했습니다.</p>
        </footer>
      </main>

      {/* 모바일·태블릿(<lg) 하단 고정 바 (이전 목록 + 핵심 액션) */}
      {selectedItem && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#e5e8eb] px-3 sm:px-4 py-2.5">
          <div className="max-w-6xl mx-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleBackToList}
              aria-label="공고 목록으로 돌아가기"
              className="min-h-[42px] px-3 py-2 bg-[#f2f4f7] hover:bg-[#e5e8eb] text-[#191f28] text-[13px] font-bold rounded-[8px] inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>이전</span>
            </button>
            <div className="flex-1 min-w-0">
              {renderActionButtons('mobile')}
            </div>
          </div>
        </div>
      )}

      {/* 다크 토스트 */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 bottom-20 lg:bottom-8 -translate-x-1/2 z-50 bg-[#191f28]/95 text-white text-[12.5px] font-medium px-3.5 py-2 rounded-[8px] shadow-lg whitespace-nowrap"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
