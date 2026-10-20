' Col Roku v0.3 isolated candidate; sample media only.
sub init()
    m.video = m.top.findNode("video")
    m.status = m.top.findNode("status")
    m.receiver = m.top.findNode("receiver")
    m.video.observeField("state", "onVideoState")
    m.receiver.observeField("command", "onReceiverCommand")
    m.receiver.observeField("connectionState", "onConnectionState")
    ' Receiver stays disabled until device-scoped credentials are provisioned.
    m.top.setFocus(true)
end sub

sub onReceiverCommand()
    cmd = m.receiver.command
    if type(cmd) <> "roAssociativeArray" then return
    letter = cmd.letter
    if type(letter) <> "roString" and type(letter) <> "String" then return
    if Len(letter) <> 1 then return
    if Instr(1, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", letter) = 0 then return
    ' Each new command event restarts video, including B followed by B.
    playAnimalCandidate(letter)
end sub

sub onConnectionState()
    if m.receiver.connectionState <> "Connected" then
        m.status.text = m.receiver.connectionState
    end if
end sub

sub playAnimalCandidate(letter as String)
    m.video.control = "stop"
    content = CreateObject("roSGNode", "ContentNode")
    ' Placeholder playback proof ONLY; not an animal catalog.
    content.url = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    content.streamFormat = "hls"
    content.title = "Animal " + letter + " - media pending"
    m.video.content = content
    m.status.text = "Letter " + letter + " received - sample playback"
    m.video.control = "play"
end sub

function onKeyEvent(key as String, press as Boolean) as Boolean
    if not press then return false
    if key = "OK" then
        playAnimalCandidate("B")
        return true
    else if key = "back" then
        m.video.control = "stop"
        m.status.text = "Stopped"
        return true
    end if
    return false
end function

sub onVideoState()
    if m.video.state = "error" then m.status.text = "Video error"
end sub
