import { useMemo } from "react";
import type { Lang } from "../../core";
import { summarize, type DailyStats } from "../../storage/stats";

interface Props {
  stats: readonly DailyStats[];
}

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
const UNIT: Record<Lang, string> = { ja: "字", en: "語" };
const SPEED_UNIT: Record<Lang, string> = { ja: "字/分", en: "語/分" };

/** ライブラリ上部の「読書の記録」。まだ何も読んでいなければ出さない */
export function StatsPanel({ stats }: Props) {
  const summary = useMemo(() => summarize(stats), [stats]);
  // 日本語と英語は単位が違うので、多く読んでいる方を棒グラフに使う
  const lang: Lang = summary.total.ja >= summary.total.en * 3 ? "ja" : "en";
  if (summary.total.ja + summary.total.en === 0) return null;

  const max = Math.max(...summary.week.map((d) => d[lang].units), 1);
  const today = summary.today[lang].units;
  const speed = summary.speed[lang];

  return (
    <section className="stats" aria-labelledby="stats-title">
      <h2 id="stats-title">読書の記録</h2>
      <div className="stats-body">
        <dl className="stats-figures">
          <div>
            <dt>今日</dt>
            <dd>
              {today.toLocaleString()}
              <small>{UNIT[lang]}</small>
            </dd>
          </div>
          <div>
            <dt>連続</dt>
            <dd>
              {summary.streak}
              <small>日</small>
            </dd>
          </div>
          <div>
            <dt>平均速度（7日）</dt>
            <dd>
              {speed === null ? "—" : speed.toLocaleString()}
              {speed !== null && <small>{SPEED_UNIT[lang]}</small>}
            </dd>
          </div>
          <div>
            <dt>累計</dt>
            <dd>
              {summary.total[lang].toLocaleString()}
              <small>{UNIT[lang]}</small>
            </dd>
          </div>
        </dl>
        <ol className="stats-week" aria-label={`直近7日に読んだ${lang === "ja" ? "文字数" : "語数"}`}>
          {summary.week.map((d, i) => {
            const [y, m, day] = d.date.split("-").map(Number) as [number, number, number];
            const weekday = WEEKDAY[new Date(y, m - 1, day).getDay()];
            const units = d[lang].units;
            return (
              <li key={d.date} className={i === 6 ? "is-today" : undefined}>
                <span className="bar" title={`${m}/${day} ${units.toLocaleString()}${UNIT[lang]}`}>
                  <i style={{ height: `${(units / max) * 100}%` }} />
                </span>
                <span className="bar-label" aria-label={`${m}月${day}日 ${units}${UNIT[lang]}`}>
                  {weekday}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
