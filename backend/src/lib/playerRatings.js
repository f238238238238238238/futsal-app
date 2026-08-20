/**
 * 選手能力値・試合評価の採点。
 * 対象大会の試合時間は 7〜10 分が基本。頻度は「出場10分あたり」で評価する。
 */

export const BLOCK_MINUTES = 10;
/** この出場時間で自動計算をほぼ信頼する（約3試合） */
export const FULL_SAMPLE_MINUTES = 30;
export const PRIOR_STAT = 50;

export function effectiveMatchMinutes(durationSeconds) {
  const m = (Number(durationSeconds) || 0) / 60;
  if (!m || m <= 0) return 10;
  // 旧デフォルトの40分は、現行の大会想定（7〜10分）に合わせて読み替える
  if (Math.abs(m - 40) < 0.6) return 10;
  return Math.max(5, m);
}

export function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/** 0 → 40、目標達成 → 約75、目標の2倍 → 約90、それ以上は99に漸近 */
export function rateToStat(rate, target) {
  if (!Number.isFinite(rate) || rate <= 0 || !target) return 40;
  const r = rate / target;
  const raw = 40 + 59 * (r / (r + 0.45));
  return Math.round(Math.min(99, Math.max(40, raw)));
}

/** 成功率など 0〜1。目標達成で約75 */
export function ratioToStat(ratio, target) {
  if (!Number.isFinite(ratio) || ratio <= 0) return 40;
  return rateToStat(ratio, target);
}

/** ミス率など「少ないほど良い」指標。0ミスで99に近づき、目標ミス率で75 */
export function inverseRateToStat(rate, badTarget) {
  if (!Number.isFinite(rate) || rate <= 0) return 85;
  return rateToStat(Math.max(0, 2 * badTarget - rate), badTarget);
}

export function shrinkToPrior(observed, minutesPlayed, prior = PRIOR_STAT) {
  const n = Math.max(0, Number(minutesPlayed) || 0);
  const w = Math.min(1, n / FULL_SAMPLE_MINUTES);
  return Math.round(prior * (1 - w) + observed * w);
}

export function perBlock(count, minutesPlayed) {
  const mins = Math.max(Number(minutesPlayed) || 0, 0.5);
  return (Number(count) || 0) / (mins / BLOCK_MINUTES);
}

export function average(values) {
  const nums = values.filter(v => Number.isFinite(v));
  if (nums.length === 0) return PRIOR_STAT;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

const DEF_TYPES = new Set(['steal', 'pass_cut', 'block', 'clear', 'recovery']);
const ACTION_TYPES = new Set([
  'pass', 'pass_miss', 'trap_miss', 'goal', 'shot', 'shot_off',
  'steal', 'pass_cut', 'block', 'clear', 'recovery', 'lost_ball',
  'save', 'catch', 'foul',
]);

export function countPlayerEvents(events, userId) {
  const c = {
    goals: 0, assists: 0, shots: 0, shotsOn: 0, shotsOff: 0,
    passes: 0, passMiss: 0, trapMiss: 0, receivedPasses: 0,
    steals: 0, passCuts: 0, blocks: 0, clears: 0, recoveries: 0,
    fouls: 0, lostBalls: 0, saves: 0, catches: 0, actions: 0,
  };
  const list = events || [];
  list.forEach((ev, i) => {
    if (sameId(ev.user_id, userId)) {
      if (ACTION_TYPES.has(ev.event_type)) c.actions++;
      switch (ev.event_type) {
        case 'goal': c.goals++; c.shots++; c.shotsOn++; break;
        case 'shot': c.shots++; c.shotsOn++; break;
        case 'shot_off': c.shots++; c.shotsOff++; break;
        case 'pass': c.passes++; break;
        case 'pass_miss': c.passMiss++; break;
        case 'trap_miss': c.trapMiss++; break;
        case 'steal': c.steals++; break;
        case 'pass_cut': c.passCuts++; break;
        case 'block': c.blocks++; break;
        case 'clear': c.clears++; break;
        case 'recovery': c.recoveries++; break;
        case 'foul': c.fouls++; break;
        case 'lost_ball': c.lostBalls++; break;
        case 'save': c.saves++; break;
        case 'catch': c.catches++; break;
        default: break;
      }
    }
    if (ev.event_type === 'pass' && sameId(ev.target_user_id, userId)) c.receivedPasses++;
    if (ev.event_type === 'goal') {
      for (let j = i - 1; j >= 0; j--) {
        const prev = list[j];
        if (['steal', 'opponent_pass', 'intercept', 'clear', 'opponent_block', 'lost_ball', 'pass_miss', 'trap_miss'].includes(prev.event_type)) break;
        if (prev.team === 'opponent') break;
        if ((prev.event_type === 'pass' || prev.event_type === 'kickoff') && sameId(prev.target_user_id, ev.user_id)) {
          if (sameId(prev.user_id, userId)) c.assists++;
          break;
        }
      }
    }
  });
  return c;
}

export function computeAbilityStats({
  counts,
  minutesPlayed,
  concedeWhileGk = 0,
  playingShare = 0.6,
  possessionSecs = 0,
}) {
  const mins = Math.max(Number(minutesPlayed) || 0, 0);
  const c = counts || {};
  const p = (n) => perBlock(n, mins || 0.5);

  const goals = p(c.goals);
  const shots = p(c.shots);
  const conversion = (c.shots > 0) ? (c.goals / c.shots) : 0;
  const involvement = p(c.receivedPasses);
  const passAttempts = (c.passes || 0) + (c.passMiss || 0);
  const passRate = passAttempts > 0 ? (c.passes / passAttempts) : 0;
  const faced = (c.saves || 0) + (c.catches || 0) + (concedeWhileGk || 0);
  const savePct = faced > 0 ? ((c.saves || 0) + (c.catches || 0)) / faced : 0;

  const positioning = rateToStat(involvement, 10);
  const finishing = c.shots > 0 ? ratioToStat(conversion, 0.28) : 50;
  const shooting = rateToStat(shots, 2.0);
  const vision = rateToStat(p(c.assists), 0.35);
  const passing = passAttempts > 0 ? ratioToStat(passRate, 0.80) : 50;
  const dribbling = inverseRateToStat(p(c.lostBalls), 0.8);
  const keeping = rateToStat(((possessionSecs || 0) / Math.max(mins || 0.5, 0.5)) * 10, 25);
  const blocking = rateToStat(p(c.blocks), 0.6);
  const intercepting = rateToStat(p(c.passCuts), 1.0);
  const clearing = rateToStat(p(c.clears), 0.8);
  const stealing = rateToStat(p(c.steals), 1.0);
  const recoveryScore = rateToStat(p(c.recoveries), 1.2);

  const defActions = (c.steals || 0) + (c.passCuts || 0) + (c.blocks || 0) + (c.clears || 0) + (c.recoveries || 0);
  const defenseRaw = rateToStat(p(defActions), 3.0);
  const foulPenalty = Math.min(8, Math.round(p(c.fouls) * 4));
  const defense = Math.max(40, defenseRaw - foulPenalty);
  const defenseAwareness = defenseRaw;

  const saving = rateToStat(p(c.saves), 1.2);
  const catchingScore = rateToStat(p(c.catches), 0.8);
  const gkPositioning = faced > 0 ? ratioToStat(savePct, 0.62) : 40;

  const actionsPerMin = mins > 0 ? (c.actions || 0) / mins : 0;
  const staminaWorkRate = rateToStat(playingShare, 0.75);
  const stamina = average([
    staminaWorkRate,
    rateToStat(actionsPerMin, 1.8),
  ]);
  const speed = rateToStat(p((c.steals || 0) + (c.passCuts || 0) + (c.recoveries || 0)), 2.0);

  const offense = average([positioning, finishing, shooting, rateToStat(goals, 0.4)]);
  const technique = average([passing, dribbling, keeping, vision]);
  const goalkeeping = faced > 0 || (c.saves || 0) + (c.catches || 0) > 0
    ? average([saving, catchingScore, faced > 0 ? gkPositioning : 50])
    : 40;
  const hasGk = faced > 0 || c.saves || c.catches;

  return {
    offense: shrinkToPrior(offense, mins),
    technique: shrinkToPrior(technique, mins),
    defense: shrinkToPrior(defense, mins),
    stamina: shrinkToPrior(stamina, mins),
    speed: shrinkToPrior(speed, mins),
    goalkeeping: hasGk ? shrinkToPrior(goalkeeping, mins) : 40,
    sub_stats: {
      positioning: shrinkToPrior(positioning, mins),
      finishing: shrinkToPrior(finishing, mins),
      shooting: shrinkToPrior(shooting, mins),
      vision: shrinkToPrior(vision, mins),
      passing: shrinkToPrior(passing, mins),
      dribbling: shrinkToPrior(dribbling, mins),
      keeping: shrinkToPrior(keeping, mins),
      blocking: shrinkToPrior(blocking, mins),
      intercepting: shrinkToPrior(intercepting, mins),
      clearing: shrinkToPrior(clearing, mins),
      stealing: shrinkToPrior(stealing, mins),
      recovery: shrinkToPrior(recoveryScore, mins),
      defenseAwareness: shrinkToPrior(defenseAwareness, mins),
      acceleration: shrinkToPrior(speed, mins),
      sprintSpeed: shrinkToPrior(speed, mins),
      staminaWorkRate: shrinkToPrior(staminaWorkRate, mins),
      saving: hasGk ? shrinkToPrior(saving, mins) : 40,
      catching: hasGk ? shrinkToPrior(catchingScore, mins) : 40,
      gkPositioning: hasGk ? shrinkToPrior(gkPositioning, mins) : 40,
    },
  };
}

export function computeMatchRating(counts, minutesPlayed = 8) {
  const c = counts || {};
  const mins = Math.max(Number(minutesPlayed) || 8, 1);
  const scale = Math.min(1.25, BLOCK_MINUTES / mins);

  let score = 6.0;
  score += Math.min(2.1, (c.goals || 0) * 0.7);
  score += Math.min(1.35, (c.assists || 0) * 0.45);
  score += Math.min(0.4, (c.shotsOn || 0) * 0.08);
  score -= (c.shotsOff || 0) * 0.04;

  const attempts = (c.passes || 0) + (c.passMiss || 0);
  if (attempts >= 4) {
    const rate = c.passes / attempts;
    score += Math.max(-0.6, Math.min(0.8, (rate - 0.75) * 2.2));
  }

  const def = (c.steals || 0) + (c.passCuts || 0) + (c.blocks || 0) + (c.clears || 0);
  score += Math.min(0.9, def * 0.14);
  score += Math.min(1.0, ((c.saves || 0) + (c.catches || 0)) * 0.22);
  score -= ((c.lostBalls || 0) + (c.passMiss || 0) + (c.trapMiss || 0)) * 0.12;
  score -= (c.fouls || 0) * 0.08;

  score = 6.0 + (score - 6.0) * scale;
  return Math.round(Math.min(9.8, Math.max(5.0, score)) * 10) / 10;
}

export function detectAssistsFromEvents(events, userId) {
  return countPlayerEvents(events, userId).assists;
}
