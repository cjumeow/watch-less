# yt-digest

A button on a YouTube thumbnail turns the video into a neutral, evidence-backed summary, so the developer can decide
from the summary whether the video is worth watching.

## Language

**Digest**:
The neutral, evidence-backed summary of one video, as a Markdown document in the sections the digest prompt defines.
_Avoid_: summary note, report, card

**Destination**:
Where a finished digest is delivered. Heptabase is the first; the digest does not depend on which one it is.
_Avoid_: sink, output, target

**Request**:
The developer handing one video to this computer for a digest, by pressing its button. A video can be requested any
number of times; the extension does not remember that it was.
_Avoid_: click, job, order

More terms are added here as the spec decides them, with `domain-modeling`.
