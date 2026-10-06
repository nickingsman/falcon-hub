"use client";

import { useMemo, useState } from "react";

import {
  NEW_LAYOUT,
  TRADITIONAL_LAYOUT,
  calculateCareerNumerology,
  calculateRelationship,
  classicLineKnowledge,
  getType45Knowledge,
  numberKnowledge,
  relationshipCombinationKnowledge,
  sacredTriangleKnowledge,
  type CareerNumerologyResult,
  type NumerologyNumber,
} from "@/lib/career-numerology";
import { Button, EmptyState, PageHeader, StatusBadge } from "../../components/ui";
import {
  InterpretationSection,
  NumberInterpretation,
  Type45Interpretation,
} from "./components/InterpretationSection";
import { NumerologyGrid } from "./components/NumerologyGrid";
import { SacredTriangle } from "./components/SacredTriangle";

type FormState = {
  name: string;
  dateOfBirth: string;
};

const emptyForm: FormState = { name: "", dateOfBirth: "" };

function fieldClassName() {
  return "mt-2 min-h-12 w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-[var(--falcon-gold-dark)] focus:ring-2 focus:ring-[#b8924a]/15";
}

function formatLayer(value: NumerologyNumber | null) {
  return value ?? "—";
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--falcon-gold-dark)]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold text-[var(--falcon-charcoal)]">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-[var(--falcon-muted-text)]">{description}</p> : null}
    </div>
  );
}

export default function CareerNumerologyPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [result, setResult] = useState<CareerNumerologyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [relationshipName, setRelationshipName] = useState("");
  const [relationshipDob, setRelationshipDob] = useState("");
  const [relationshipResult, setRelationshipResult] = useState<CareerNumerologyResult | null>(null);
  const [relationshipError, setRelationshipError] = useState<string | null>(null);

  const relationshipCalculation = useMemo(() => {
    if (!result || !relationshipResult) return null;
    return calculateRelationship(result.lifeNumber, relationshipResult.lifeNumber);
  }, [result, relationshipResult]);

  function analyze() {
    const calculation = calculateCareerNumerology({ dateOfBirth: form.dateOfBirth });

    if (!calculation) {
      setError("请输入有效的出生日期。");
      setResult(null);
      return;
    }

    setError(null);
    setResult(calculation);
    setRelationshipResult(null);
    setRelationshipError(null);
  }

  function reset() {
    setForm(emptyForm);
    setResult(null);
    setError(null);
    setRelationshipName("");
    setRelationshipDob("");
    setRelationshipResult(null);
    setRelationshipError(null);
  }

  function analyzeRelationship() {
    if (!result) return;
    const calculation = calculateCareerNumerology({ dateOfBirth: relationshipDob });
    if (!calculation) {
      setRelationshipError("请输入对方有效的出生日期。");
      setRelationshipResult(null);
      return;
    }
    setRelationshipError(null);
    setRelationshipResult(calculation);
  }

  const currentStage = result?.stages.find((stage) => stage.id === result.currentStageId);
  const type45 = result ? getType45Knowledge(result.combination) : undefined;
  const externalNumber = type45 ? type45.outerNumber : result?.layers.externalAbility ?? null;
  const internalNumber = type45 ? type45.innerNumber : result?.layers.internalThought ?? null;
  const verifiedStageKnowledge = result
    ? result.stageTable
      .map((column) => ({ column, entry: getType45Knowledge(column.stageChain) }))
      .filter((item) => item.entry?.summary && item.column.stageChain !== result.combination)
    : [];

  return (
    <main lang="zh-CN" className="min-h-screen bg-[var(--falcon-warm-background)] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="内部分析工具"
          title="生涯运数"
          description="以出生日期计算 4U 生涯组合、人生阶段、九宫天赋、流年、圣三角与人际合并数。所有资料只在本页计算，不会储存或传送。"
          actions={result ? <Button type="button" variant="secondary" onClick={reset}>重新计算</Button> : null}
          meta={<StatusBadge variant="accent">本地运算 · 不储存资料</StatusBadge>}
        />

        <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
          <SectionTitle eyebrow="开始" title="输入基本资料" description="姓名为选填；出生日期只用于本次分析。" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="font-semibold text-zinc-700">姓名（选填）</span>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={fieldClassName()} placeholder="输入姓名" autoComplete="off" />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-zinc-700">出生日期</span>
              <input type="date" value={form.dateOfBirth} onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))} className={fieldClassName()} />
            </label>
          </div>
          {error ? <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p> : null}
          <div className="mt-5"><Button type="button" onClick={analyze}>开始分析</Button></div>
        </section>

        {!result ? (
          <EmptyState variant="dashed" title="等待分析" description="输入出生日期后，即可查看完整的生涯运数结构。" />
        ) : (
          <>
            <section className="rounded-[28px] border border-[#d8c48e] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <SectionTitle eyebrow="核心结果" title={form.name.trim() ? `${form.name.trim()}的生涯运数` : "核心生涯运数"} />
                  <p className="mt-5 text-5xl font-semibold tracking-tight text-[var(--falcon-charcoal)] sm:text-6xl">{result.combination}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusBadge variant="accent">天赋数 {result.talentNumber}</StatusBadge>
                    <StatusBadge variant="neutral">生涯运数 {result.lifeNumber}</StatusBadge>
                    <StatusBadge variant="neutral">当前年龄 {result.age}</StatusBadge>
                  </div>
                </div>
                <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-2xl">
                  {[
                    ["外在＋能力", formatLayer(externalNumber)],
                    ["内在＋想法", formatLayer(internalNumber)],
                    ["本命＋特性", result.layers.lifeCharacter],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] p-4 text-center">
                      <p className="text-xs font-semibold text-zinc-500">{label}</p>
                      <p className="mt-2 text-3xl font-semibold text-zinc-950">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                {externalNumber ? <NumberInterpretation label="外在＋能力" entry={numberKnowledge[externalNumber]} /> : null}
                {internalNumber ? <NumberInterpretation label="内在＋想法" entry={numberKnowledge[internalNumber]} /> : null}
                <NumberInterpretation label="本命＋特性" entry={numberKnowledge[result.layers.lifeCharacter]} />
                {type45 ? <div className="lg:col-span-3"><Type45Interpretation entry={type45} /></div> : null}
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle eyebrow="人生阶段" title="生涯运数分析表" description={currentStage && currentStage.id !== "73-plus" ? `目前阶段：${currentStage.ageRange}` : undefined} />
              {result.currentStageId === "under-19" ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">V1 从 19 岁开始分析；0–18 岁阶段需要出生时辰，因此暂不计算。</p> : null}
              <div className="mt-5 max-w-full overflow-x-auto rounded-2xl border border-[var(--falcon-soft-border)]">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead className="bg-[var(--falcon-warm-background)]">
                    <tr>
                      <th className="border-b border-r border-[var(--falcon-soft-border)] px-4 py-3 text-left font-semibold text-zinc-600">时间单位</th>
                      {result.stageTable.map((column) => <th key={column.unit} className="border-b border-r border-[var(--falcon-soft-border)] px-4 py-3 text-center text-base font-semibold text-zinc-950 last:border-r-0">{column.unit}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "出生日期", value: (column: (typeof result.stageTable)[number]) => column.birthValue },
                      { label: "阶段数", value: (column: (typeof result.stageTable)[number]) => column.stageChain },
                      { label: "阶段岁数", value: (column: (typeof result.stageTable)[number]) => column.ageRange },
                    ].map((row) => (
                      <tr key={row.label} className="border-b border-[var(--falcon-soft-border)] last:border-b-0">
                        <th className="border-r border-[var(--falcon-soft-border)] bg-zinc-50/70 px-4 py-3 text-left font-semibold text-zinc-600">{row.label}</th>
                        {result.stageTable.map((column) => (
                          <td key={column.unit} className={`border-r border-[var(--falcon-soft-border)] px-4 py-3 text-center font-semibold tabular-nums last:border-r-0 ${column.stageId === result.currentStageId ? "bg-[#fbf8ef] text-[var(--falcon-gold-dark)]" : "text-zinc-950"}`}>{row.value(column)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {verifiedStageKnowledge.length ? (
                <div className="mt-5 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-950">已验证阶段解析</h3>
                  {verifiedStageKnowledge.map(({ column, entry }) => entry ? (
                    <details key={column.unit} className="group rounded-2xl border border-[var(--falcon-soft-border)] bg-white p-4">
                      <summary className="cursor-pointer list-none font-semibold text-zinc-900">{column.unit}阶段 · {column.stageChain}<span className="float-right text-[var(--falcon-gold-dark)] group-open:rotate-45">＋</span></summary>
                      <div className="mt-3"><Type45Interpretation entry={entry} compact /></div>
                    </details>
                  ) : null)}
                </div>
              ) : null}
            </section>

            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle eyebrow="传统九宫" title="九宫天赋" description="同一数字可同时拥有多种符号；连线只依据数字是否存在。" />
              <div className="mt-6"><NumerologyGrid layout={TRADITIONAL_LAYOUT} cells={result.cells} lines={result.traditionalLines} label="传统九宫天赋图" /></div>
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-950">缺数</h3>
                  <div className="mt-3 flex flex-wrap gap-2">{result.missingNumbers.length ? result.missingNumbers.map((number) => <StatusBadge key={number} variant="warning">缺 {number}</StatusBadge>) : <StatusBadge variant="success">没有缺数</StatusBadge>}</div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-950">已形成连线</h3>
                  <div className="mt-3 flex flex-wrap gap-2">{result.traditionalLines.length ? result.traditionalLines.map((line) => <StatusBadge key={line.id} variant="accent">{line.id}</StatusBadge>) : <StatusBadge variant="neutral">没有形成连线</StatusBadge>}</div>
                  <div className="mt-3 grid gap-2">{result.traditionalLines.map((line) => <InterpretationSection key={line.id} title={`${line.id} 连线`} entry={classicLineKnowledge[line.id]} />)}</div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle eyebrow="新九宫" title="新九宫天赋" description="采用同一组符号资料，只改变排列与三数直线规则。" />
              <div className="mt-6"><NumerologyGrid layout={NEW_LAYOUT} cells={result.cells} lines={result.newLines} label="新九宫天赋图" /></div>
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-zinc-950">已形成连线</h3>
                <div className="mt-3 flex flex-wrap gap-2">{result.newLines.length ? result.newLines.map((line) => <StatusBadge key={line.id} variant="accent">{line.id}｜连线成立</StatusBadge>) : <StatusBadge variant="neutral">没有形成连线</StatusBadge>}</div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
                <SectionTitle eyebrow="当前流年" title={`${result.personalYear.chain.join("/")} 流年`} description="流年从生日当天更新，完整计算链如下。" />
                <div className="mt-5 rounded-2xl border border-[#d8c48e] bg-[#fbf8ef] p-5 text-center">
                  <p className="text-sm font-semibold text-zinc-600">{result.personalYear.applicableYear} / {result.stageTable[1]?.birthValue} / {result.stageTable[2]?.birthValue}</p>
                  <div className="mt-4 space-y-2">
                    {result.personalYear.calculationSteps.map((step, index) => (
                      <div key={`${step.total}-${index}`}>
                        {index > 0 ? <p aria-hidden="true" className="text-lg text-[var(--falcon-gold-dark)]">↓</p> : null}
                        <p className="text-sm font-medium tabular-nums text-zinc-600 sm:text-base">{step.digits.join(" + ")}</p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">= {step.total}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[var(--falcon-gold-dark)]">完整流年组合：{result.personalYear.chain.join("/")}</p>
                </div>
              </div>
              <div className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
                <SectionTitle eyebrow="星座数" title={`${result.zodiac.name} · ${result.zodiac.number}`} description={`已根据出生日期自动判断，并将 ☆ 加入九宫数字 ${result.zodiac.number}。`} />
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle eyebrow="圣三角运势" title="九个运势位置" description={`以流年 ${result.personalYear.number} 作为主运，依序循环排列。`} />
              <div className="mt-6"><SacredTriangle values={result.sacredTriangle} lifeNumber={result.lifeNumber} /></div>
              <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)]">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3">
                  {result.sacredTriangle.map((item) => {
                    const knowledge = sacredTriangleKnowledge[item.position];
                    return (
                      <div key={item.position} className="border-b border-[var(--falcon-soft-border)] p-4 sm:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0">
                        <p className="text-sm font-semibold text-zinc-950">{item.position} · {item.value}</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-600">{knowledge.content}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle eyebrow="人际运数" title="计算双方合并数" description="对方出生日期只在本页计算，不会储存。合并数 10、11、12 会保留，不再约化。" />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block text-sm"><span className="font-semibold text-zinc-700">对方姓名（选填）</span><input value={relationshipName} onChange={(event) => setRelationshipName(event.target.value)} className={fieldClassName()} placeholder="输入对方姓名" autoComplete="off" /></label>
                <label className="block text-sm"><span className="font-semibold text-zinc-700">对方出生日期</span><input type="date" value={relationshipDob} onChange={(event) => setRelationshipDob(event.target.value)} className={fieldClassName()} /></label>
              </div>
              {relationshipError ? <p role="alert" className="mt-4 text-sm font-medium text-red-700">{relationshipError}</p> : null}
              <div className="mt-5"><Button type="button" variant="secondary" onClick={analyzeRelationship}>计算合并数</Button></div>
              {relationshipResult && relationshipCalculation ? (
                <div className="mt-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[var(--falcon-soft-border)] p-4"><p className="text-xs font-semibold text-zinc-500">我的生涯运数</p><p className="mt-2 text-3xl font-semibold">{result.lifeNumber}</p></div>
                    <div className="rounded-2xl border border-[var(--falcon-soft-border)] p-4"><p className="text-xs font-semibold text-zinc-500">{relationshipName.trim() ? `${relationshipName.trim()}的生涯运数` : "对方生涯运数"}</p><p className="mt-2 text-3xl font-semibold">{relationshipResult.lifeNumber}</p></div>
                    <div className="rounded-2xl border border-[#d8c48e] bg-[#fbf8ef] p-4"><p className="text-xs font-semibold text-[var(--falcon-gold-dark)]">合并数</p><p className="mt-2 text-3xl font-semibold">{relationshipCalculation.result}</p></div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] p-4 text-center">
                    <p className="text-lg font-semibold tabular-nums text-zinc-950">{relationshipCalculation.first} + {relationshipCalculation.second} = {relationshipCalculation.rawSum}</p>
                    {relationshipCalculation.reductionDigits ? <><p aria-hidden="true" className="my-1 text-lg text-[var(--falcon-gold-dark)]">↓</p><p className="text-base font-semibold tabular-nums text-zinc-700">{relationshipCalculation.reductionDigits.join(" + ")} = {relationshipCalculation.result}</p></> : <p className="mt-1 text-sm text-zinc-500">合并数 10–12 保留，不再约化。</p>}
                  </div>
                  {(() => {
                    const knowledge = relationshipCombinationKnowledge[relationshipCalculation.result];
                    if (!knowledge.strengths?.length && !knowledge.challenges?.length) return null;
                    return (
                      <div className="mt-3 rounded-2xl border border-[#d8c48e] bg-[#fbf8ef] p-4 sm:p-5">
                        <h3 className="font-semibold text-zinc-950">{knowledge.title}</h3>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          {knowledge.strengths?.length ? <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--falcon-gold-dark)]">优点</p><div className="mt-2 space-y-2 text-sm leading-6 text-zinc-700">{knowledge.strengths.map((item) => <p key={item}>{item}</p>)}</div></div> : null}
                          {knowledge.challenges?.length ? <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--falcon-gold-dark)]">需要留意</p><div className="mt-2 space-y-2 text-sm leading-6 text-zinc-700">{knowledge.challenges.map((item) => <p key={item}>{item}</p>)}</div></div> : null}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
