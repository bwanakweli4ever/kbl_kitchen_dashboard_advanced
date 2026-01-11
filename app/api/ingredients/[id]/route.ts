import { NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = request.headers.get("authorization")
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const token = authorization.replace("Bearer ", "")
    const body = await request.json()

    const response = await fetch(`${config.api.baseUrl}/api/ingredients/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json(data)
    } else {
      const error = await response.text()
      return NextResponse.json({ error }, { status: response.status })
    }
  } catch (error) {
    console.error("Update ingredient error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

