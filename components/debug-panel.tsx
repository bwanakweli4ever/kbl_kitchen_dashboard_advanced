"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function DebugPanel() {
  const [testResult, setTestResult] = useState<any>(null)
  const [testing, setTesting] = useState(false)

  const testConnection = async () => {
    setTesting(true)
    try {
      // Test the health endpoint first
      const healthResponse = await fetch("/api/test-connection")
      const healthData = await healthResponse.json()
      setTestResult(healthData)
    } catch (error) {
      setTestResult({
        error: "Connection failed",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">🔧 Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={testConnection}
          disabled={testing}
          variant="outline"
          size="sm"
          className="w-full bg-transparent"
        >
          {testing ? "Testing..." : "Test API Connection"}
        </Button>

        {testResult && (
          <div className="text-xs space-y-2">
            <div className="flex items-center gap-2">
              <span>Status:</span>
              <Badge variant={testResult.error ? "destructive" : "default"}>
                {testResult.error ? "Failed" : "Success"}
              </Badge>
            </div>

            <div className="bg-gray-100 p-2 rounded text-xs font-mono">
              <pre>{JSON.stringify(testResult, null, 2)}</pre>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500">
          <p>
            <strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_URL || "Not set"}
          </p>
          <p>
            <strong>Expected format:</strong> https://your-api-domain.com
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
