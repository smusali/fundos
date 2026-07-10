import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = dirname(fileURLToPath(import.meta.url));
const FIXED_DATE = new Date('2026-01-15T00:00:00Z');
const INK = rgb(0.12, 0.13, 0.18);
const MUTED = rgb(0.4, 0.42, 0.5);

async function renderPdf(pages, { width, height }) {
  const doc = await PDFDocument.create();
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  for (const { title, lines } of pages) {
    const page = doc.addPage([width, height]);
    page.drawText(title, { x: 48, y: height - 72, size: 22, font: bold, color: INK });
    let y = height - 116;
    for (const line of lines) {
      page.drawText(line, { x: 48, y, size: 12, font: regular, color: MUTED });
      y -= 22;
    }
  }
  return doc.save();
}

const helixDeck = [
  { title: 'Helix Compliance', lines: ['AI copilots for bank compliance teams', 'Seed round, 2026', 'Confidential'] },
  {
    title: 'Problem',
    lines: [
      'Regional banks spend $2.4M per year on manual transaction review.',
      'Alert false-positive rates run above 92% on legacy rules engines.',
      'Compliance analysts burn 6 hours per suspicious-activity case.',
    ],
  },
  {
    title: 'Solution',
    lines: [
      'An AI agent triages every alert with cited evidence from the case file.',
      'Analysts review a ranked queue instead of a raw feed.',
      'Every disposition is logged with its supporting documents for examiners.',
    ],
  },
  {
    title: 'Product',
    lines: [
      'Alert triage queue, case workspace, and examiner-ready audit exports.',
      'Deploys inside the bank VPC; no customer data leaves the tenant.',
      'SOC 2 Type II audit in progress, expected Q3 2026.',
    ],
  },
  {
    title: 'Market',
    lines: [
      'Financial crime compliance software TAM: $8.7B in 2026.',
      'Bottoms-up: 4,200 US regional banks x $180K ACV = $756M serviceable market.',
      'Consent orders and BSA enforcement grew 40% since 2024.',
    ],
  },
  {
    title: 'Business Model',
    lines: [
      'Annual SaaS license, $150K average contract value.',
      'Usage tiers by alert volume; implementation fee under 10% of ACV.',
      'Land with transaction monitoring, expand to KYC refresh and sanctions.',
    ],
  },
  {
    title: 'Traction',
    lines: [
      'ARR $410K across 6 bank customers as of May 2026.',
      'Alert triage precision 94% measured against analyst ground truth.',
      'Net revenue retention 118%; zero logo churn since launch.',
    ],
  },
  {
    title: 'Team',
    lines: [
      'CEO Dana Whitfield: 11 years Chief Compliance Officer, First Coast Bank.',
      'CTO Marcus Lee: 8 years ML infrastructure at Stripe.',
      '9 FTEs total; all engineering in-house.',
    ],
  },
  {
    title: 'Competition',
    lines: [
      'Legacy rules engines: NICE Actimize, Verafin. High false positives.',
      'Horizontal AI tools lack examiner-ready audit trails.',
      'Helix wins on cited evidence per disposition and VPC deployment.',
    ],
  },
  {
    title: 'Financials',
    lines: [
      'Monthly burn $95K; 14 months runway at current plan.',
      'Gross margin 71%; services under 8% of revenue.',
      '2026 exit ARR plan: $1.2M.',
    ],
  },
  {
    title: 'The Ask',
    lines: [
      'Raising $3M seed for 18 months of runway.',
      'Use of funds: 10 bank pilots, SOC 2 completion, 4 engineering hires.',
      'Committed: $750K from existing angels.',
    ],
  },
  { title: 'Contact', lines: ['Dana Whitfield, CEO', 'dana@helixcompliance.example', 'New York, NY'] },
];

const cascadeDeck = [
  { title: 'Cascade Health', lines: ['AI prior-authorization workflow for specialty clinics', 'Series A, 2026'] },
  {
    title: 'Problem',
    lines: [
      'Specialty clinics wait 12 days on average for prior authorization.',
      '31% of first submissions are denied for missing documentation.',
      'Each denial costs a clinic $118 in staff rework.',
    ],
  },
  {
    title: 'Solution',
    lines: [
      'Cascade drafts payer-specific authorization packets from the EHR chart.',
      'Missing clinical evidence is flagged before submission, not after denial.',
      'Approvals land in 3.2 days on average across live sites.',
    ],
  },
  {
    title: 'Market',
    lines: [
      'US prior-authorization spend: $3.1B in administrative labor annually.',
      'Bottoms-up: 38,000 specialty clinics x $60K ACV = $2.3B serviceable market.',
      'CMS interoperability rules mandate electronic prior auth by 2027.',
    ],
  },
  {
    title: 'Traction',
    lines: [
      'ARR $1.8M, up 3.4x year over year.',
      '41 clinic customers; 96% gross revenue retention.',
      'First-pass approval rate 89% versus 69% industry baseline.',
    ],
  },
  {
    title: 'Team',
    lines: [
      'CEO Dr. Priya Raman: 9 years practicing oncologist, ex-UnitedHealth clinical ops.',
      'CTO Alex Fournier: ex-Epic integration lead, 12 years health IT.',
      'Head of ML from Tempus; 22 FTEs.',
    ],
  },
  {
    title: 'Business Model',
    lines: [
      'Per-provider SaaS subscription, $60K average ACV.',
      'Gross margin 68% at current scale.',
      'Expansion: denial appeals and payer analytics modules.',
    ],
  },
  {
    title: 'Financials',
    lines: [
      'Monthly burn $210K; runway to Q4 2027 post-raise.',
      'CAC payback 11 months; NRR 124%.',
      'Services 14% of revenue and falling.',
    ],
  },
  {
    title: 'The Ask',
    lines: [
      'Raising $12M Series A led round.',
      'Use of funds: payer integrations, 3 new specialties, compliance team.',
    ],
  },
  { title: 'Contact', lines: ['Dr. Priya Raman, CEO', 'priya@cascadehealth.example', 'Denver, CO'] },
];

const LETTER = { width: 612, height: 792 };
const SLIDE = { width: 720, height: 405 };

const dataroom = {
  'overview-memo.pdf': [
    {
      title: 'Helix Compliance: Company Overview',
      lines: [
        'Prepared for investor diligence, May 2026.',
        '',
        'Helix Compliance builds AI triage software for bank compliance teams.',
        'The company was founded in 2024 in New York by Dana Whitfield and',
        'Marcus Lee. The product deploys inside the bank VPC and produces',
        'examiner-ready audit trails for every alert disposition.',
        '',
        'Six regional banks are in production. The oldest customer, First',
        'Coast Bank, has run Helix for 14 months across 3 business lines.',
        'Average deployment time is 6 weeks from contract to first triage.',
      ],
    },
    {
      title: 'Regulatory Posture',
      lines: [
        'Helix maintains a model risk management file per SR 11-7 guidance.',
        'Every model decision retains its input evidence for 7 years.',
        'SOC 2 Type II audit fieldwork began April 2026 with Prescient Assurance.',
      ],
    },
  ],
  'financial-summary.pdf': [
    {
      title: 'Financial Summary FY2025-2026',
      lines: [
        'ARR by quarter (contracted, USD):',
        'Q2 2025: $95,000',
        'Q3 2025: $170,000',
        'Q4 2025: $240,000',
        'Q1 2026: $335,000',
        'Q2 2026: $410,000',
        '',
        'Gross margin: 71% blended over trailing twelve months.',
        'Monthly operating burn: $95,000 as of May 2026.',
        'Cash on hand: $1.33M; runway 14 months.',
      ],
    },
    {
      title: 'Revenue Quality',
      lines: [
        'All six customers on annual contracts, paid annually up front.',
        'Net revenue retention: 118% (two expansions, zero churn).',
        'Largest customer is 28% of ARR.',
        'Services revenue: 8% of total, implementation only.',
      ],
    },
  ],
  'cap-table.pdf': [
    {
      title: 'Capitalization Table',
      lines: [
        'As of 2026-05-01, fully diluted:',
        '',
        'Dana Whitfield (CEO): 38.0%',
        'Marcus Lee (CTO): 32.0%',
        'Employee option pool: 12.0%',
        'Angel round (2024, $750K SAFE, $6M cap): 11.5%',
        'Advisors: 1.5%',
        'Unallocated: 5.0%',
        '',
        'No debt, no secondary sales, single class of common.',
      ],
    },
  ],
  'customer-pipeline.pdf': [
    {
      title: 'Customer Pipeline, June 2026',
      lines: [
        'Signed (6): First Coast Bank, Ridgeline Bancorp, Harbor Trust,',
        '  Blue Prairie Bank, Solstice Federal, Kestrel Community Bank.',
        '',
        'Contract stage (2): Alder State Bank ($160K), Pinebrook Financial ($190K).',
        'Pilot stage (4): combined potential ARR $610K.',
        'Qualified conversations (11): sourced via compliance officer referrals.',
        '',
        'Average sales cycle signed-to-date: 4.5 months.',
      ],
    },
  ],
  'security-compliance.pdf': [
    {
      title: 'Security and Data Rights',
      lines: [
        'Deployment: single-tenant VPC per bank; no cross-tenant data flows.',
        'Encryption: AES-256 at rest, TLS 1.3 in transit, KMS-managed keys.',
        'Data rights: all customer contracts grant model-improvement rights',
        '  on de-identified alert dispositions (clause 7.2 standard).',
        'Subprocessors: AWS us-east-1 only.',
        'SOC 2 Type II: fieldwork in progress, report expected Q3 2026.',
        'Incident response: written IR program, 24-hour customer notification SLA.',
      ],
    },
  ],
};

mkdirSync(join(root, 'decks'), { recursive: true });
mkdirSync(join(root, 'dataroom'), { recursive: true });

writeFileSync(join(root, 'decks', 'helix-compliance-seed.pdf'), await renderPdf(helixDeck, SLIDE));
writeFileSync(join(root, 'decks', 'cascade-health-series-a.pdf'), await renderPdf(cascadeDeck, SLIDE));
for (const [name, pages] of Object.entries(dataroom)) {
  writeFileSync(join(root, 'dataroom', name), await renderPdf(pages, LETTER));
}
console.log('fixtures generated');
