import { NextResponse } from "next/server";
import {
  completedTodoLimit,
  incompleteTodoLimit,
  parsePersonalTodoTitle,
  requirePersonalTodoMember,
  toPersonalTodoResponse,
  type PersonalTodoRow,
} from "./todo-service";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const todoSelect = "id, title, is_completed, completed_at, created_at, updated_at";

export async function GET() {
  const authorization = await requirePersonalTodoMember();
  if (!authorization.authorized) return authorization.response;

  try {
    const supabase = createSupabaseAdminClient();
    const [incompleteResult, completedResult] = await Promise.all([
      supabase
        .from("personal_todos")
        .select(todoSelect, { count: "exact" })
        .eq("member_id", authorization.memberId)
        .eq("is_completed", false)
        .order("created_at", { ascending: false })
        .limit(incompleteTodoLimit),
      supabase
        .from("personal_todos")
        .select(todoSelect)
        .eq("member_id", authorization.memberId)
        .eq("is_completed", true)
        .order("completed_at", { ascending: false })
        .limit(completedTodoLimit),
    ]);

    if (incompleteResult.error) throw incompleteResult.error;
    if (completedResult.error) throw completedResult.error;

    const incomplete = (incompleteResult.data ?? []) as PersonalTodoRow[];
    const completed = (completedResult.data ?? []) as PersonalTodoRow[];

    return NextResponse.json({
      tasks: [...incomplete, ...completed].map(toPersonalTodoResponse),
      incompleteCount: incompleteResult.count ?? incomplete.length,
      completedShown: completed.length,
      hasMoreIncomplete: (incompleteResult.count ?? incomplete.length) > incompleteTodoLimit,
      limits: {
        incomplete: incompleteTodoLimit,
        completed: completedTodoLimit,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/todos error:", error);
    return NextResponse.json({ error: "Unable to load your To-Do List" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await requirePersonalTodoMember();
  if (!authorization.authorized) return authorization.response;

  try {
    const body = (await request.json()) as { title?: unknown };
    const title = parsePersonalTodoTitle(body.title);

    if (!title) {
      return NextResponse.json(
        { error: "Task title is required and must be 200 characters or fewer" },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("personal_todos")
      .insert({ member_id: authorization.memberId, title })
      .select(todoSelect)
      .single();

    if (error) throw error;

    return NextResponse.json(toPersonalTodoResponse(data as PersonalTodoRow), { status: 201 });
  } catch (error) {
    console.error("POST /api/dashboard/todos error:", error);
    return NextResponse.json({ error: "Unable to add task" }, { status: 500 });
  }
}

