export type SessionDetailUrlState = {
  page: number;
  level: "all" | "info" | "error";
  from: string;
  to: string;
  filtered: boolean;
};

type SearchParamValue = string | string[] | undefined;
type SearchParamRecord = Record<string, SearchParamValue>;

function getSearchParam(searchParams: SearchParamRecord, key: string): string {
  const value = searchParams[key];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return "";
}

export function parseSessionDetailUrlState(searchParams: SearchParamRecord): SessionDetailUrlState {
  const pageValue = Number.parseInt(getSearchParam(searchParams, "page"), 10);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;

  const levelValue = getSearchParam(searchParams, "level");
  const level = levelValue === "info" || levelValue === "error" ? levelValue : "all";

  return {
    page,
    level,
    from: getSearchParam(searchParams, "from"),
    to: getSearchParam(searchParams, "to"),
    filtered: getSearchParam(searchParams, "filtered") === "1",
  };
}

export function buildSessionDetailUrlQuery(state: SessionDetailUrlState): string {
  const query = new URLSearchParams();
  if (state.page > 1) {
    query.set("page", String(state.page));
  }
  if (state.level !== "all") {
    query.set("level", state.level);
  }
  if (state.from) {
    query.set("from", state.from);
  }
  if (state.to) {
    query.set("to", state.to);
  }
  if (state.filtered) {
    query.set("filtered", "1");
  }
  return query.toString();
}
