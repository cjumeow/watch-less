# yt-digest

A button on a YouTube thumbnail turns the video into a faithful summary, so the developer can decide
from the summary whether the video is worth watching.

## Language

**Digest**:
The faithful summary of one video, in the speaker's own terms, as a Markdown document in the sections the digest prompt defines.
_Avoid_: summary note, report, card

**Destination**:
Where a finished digest is delivered. Heptabase is the first; the digest does not depend on which one it is.
_Avoid_: sink, output, target

**Request**:
The developer handing one video to this computer for a digest, by pressing its button. A video can be requested any
number of times; the extension does not remember that it was.
_Avoid_: click, job, order

**Queue**:
The requests received and not yet turned into a digest, oldest first.
_Avoid_: jobs, tasks, backlog

**Transcript**:
The words of a video with their timestamps, from its subtitles, its automatic captions, or its audio transcribed by
Whisper.
_Avoid_: subtitles, captions (each is one source of a transcript)

**Description**:
The text the uploader wrote under a video, links included, as yt-dlp gives it. The worker sends it to the model as
untrusted data, like the transcript, so the model can list the video's references with their links.
_Avoid_: show notes, about, info

**Reference**:
Something a video cites that the reader could look up, such as an article, a paper, a GitHub repository, a book or
a tool: a link its description lists as a source, or something the speaker names as one, listed in the digest's
References section with the description's link when it has one. A sponsor, an affiliate or social link, and a vague
appeal that names nothing, is not a reference.
_Avoid_: source, citation, resource

**Usage limit**:
How much the developer's Claude subscription allows in a period. A digest that meets it is **postponed**: it waits
in the queue and runs later, which is not a failure.
_Avoid_: quota, rate limit

More terms are added here as the spec decides them, with `domain-modeling`.
