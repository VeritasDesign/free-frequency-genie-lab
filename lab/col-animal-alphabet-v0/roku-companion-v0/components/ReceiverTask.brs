' SceneGraph Task: HTTPS-only receiver command polling.
' Not activated by default; requires authenticated durable service.
sub init()
    m.top.functionName = "pollCommands"
end sub

sub pollCommands()
    if not m.top.enabled then
        m.top.connectionState = "Not paired"
        return
    end if
    endpoint = m.top.endpoint
    receiverId = m.top.receiverId
    receiverToken = m.top.receiverToken
    if Left(endpoint, 8) <> "https://" or Len(receiverId) = 0 or Len(receiverToken) = 0 then
        m.top.connectionState = "Pairing required"
        return
    end if
    afterId = 0
    failureCount = 0
    while m.top.enabled
        url = endpoint + "/api/receiver/next?receiverId=" + receiverId + "&after=" + afterId.ToStr()
        transfer = CreateObject("roUrlTransfer")
        transfer.SetUrl(url)
        transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
        transfer.InitClientCertificates()
        transfer.AddHeader("Authorization", "Bearer " + receiverToken)
        transfer.AddHeader("Accept", "application/json")
        transfer.SetRequest("GET")
        port = CreateObject("roMessagePort")
        transfer.SetMessagePort(port)
        if transfer.AsyncGetToString() then
            response = wait(7000, port)
            if type(response) = "roUrlEvent" and response.GetResponseCode() = 200 then
                payload = ParseJson(response.GetString())
                if type(payload) = "roAssociativeArray" then
                    if payload.command <> invalid and type(payload.command) = "roAssociativeArray" then
                        candidate = payload.command
                        if type(candidate.commandId) = "Integer" and type(candidate.letter) = "roString" then
                            if candidate.commandId > afterId and Len(candidate.letter) = 1 then
                                if Instr(1, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", candidate.letter) > 0 then
                                    afterId = candidate.commandId
                                    m.top.command = {commandId: afterId, letter: candidate.letter}
                                end if
                            end if
                        end if
                    end if
                    m.top.connectionState = "Connected"
                    failureCount = 0
                else
                    failureCount = failureCount + 1
                    m.top.connectionState = "Invalid response"
                end if
            else
                failureCount = failureCount + 1
                m.top.connectionState = "Not connected"
            end if
        else
            failureCount = failureCount + 1
            m.top.connectionState = "Not connected"
        end if
        if failureCount > 0 then
            delayMs = 1000 * failureCount
            if delayMs > 10000 then delayMs = 10000
            Sleep(delayMs)
        else
            Sleep(1200)
        end if
    end while
end sub
