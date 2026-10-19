sub init()
    m.video = m.top.findNode("video")
    m.status = m.top.findNode("status")
    m.video.observeField("state", "onVideoState")
    m.top.setFocus(true)
end sub

function onKeyEvent(key as String, press as Boolean) as Boolean
    if not press then return false
    if key = "OK" then
        playSample()
        return true
    else if key = "back" then
        m.video.control = "stop"
        m.status.text = "Video stopped. Press OK to restart."
        return true
    end if
    return false
end function

sub playSample()
    ' Public sample HLS stream; not an animal video or licensed product catalog.
    ' The network, stream availability and device decoder are not yet verified.
    m.video.control = "stop"
    content = CreateObject("roSGNode", "ContentNode")
    content.url = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    content.streamFormat = "hls"
    content.title = "Video playback test"
    m.video.content = content
    m.status.text = "Loading video sample..."
    m.video.control = "play"
end sub

sub onVideoState()
    state = m.video.state
    if state = "playing" then
        m.status.text = "VIDEO PLAYBACK PASS - sample playing"
    else if state = "error" then
        m.status.text = "Video error - check stream/network; report error"
    else if state = "finished" then
        m.status.text = "Video finished. Press OK to replay."
    end if
end sub
