---
title: "Arch Pacman 404"
date: 2026-02-11T10:30:00-05:00
draft: false
tags: ["Linux", "Arch", "DevOps"]
categories: ["Troubleshooting"]
author: "Ian McRae"
showToc: true
TocOpen: false
---

## The Problem
As part of my plan to spin up this blog, I tried to install Hugo from my package manager 'Pacman' `sudo pacman -S hugo`, but this led to a '404' error (see Appendix A for full error).

## The Solution
The fix was to modify my command to update the catalogue of packages available in pacman prior to syncing the package: `sudo pacman -Syu hugo`. This was a simple fix but fundamental to rolling-release distributions, and one I could see needing on a regular basis.

## Starting Understanding
* 400 codes are errors (as opposed to 200s which are usually different success codes).
* Pacman is my package manager - it can be used to remotely download software that is owned and maintainted by third parties. It references a catalogue of packages from which it can download. Among other things, it establishes trust by managing what packages are in its catalogue. 
* The package manager has a default location it will save these packages, in this instacne /usr/bin/<package>. This is different to how I initially thought of it, when I would try to "navigate" to a directory where I wanted the package to be active and "download" it there, or worse 'mkdir ~/applications/<package-name>'. 
* When it saves the package in /usr/bin, that also places hugo in my system's $PATH. When called, the system goes to this $PATH and looks through the directories. For example /usr/local/bin:/usr/bin:/bin -- stopping when it finds 'hugo' in usr/bin. This can cause shadowing issues, if for example a package exists in two locations, the system will use the first one it finds (left to right).

## What I Learned
* Arch Linux mirrors move fast. When I ran the command without the `y` flag, my local database was looking for an old version of Hugo that had been purged from the server. 
* Pacman is the client application. It is responsible for the logic of managing packages locally. 
* Arch Linux mirrors (and there are many throughout the phsyical world due to geography and redundancy needs) are the servers that host the packages themselves including their source code and compiled binaries.
* 400 codes are usually *client side* errors, meaning there was something about my computer's request that was wrong when it was passed to the pacman server. Looking at how specific the version was in the call, added to the new understanding of 404s, this led me to believe I was attempting to download the wrong version.
* Subcommands aren't executed left to right. The fix -Syu (Sync, Refresh, Sysupgrade) is actually processed -yuS -- first pacman reaches out to update its local cache (specifically core.db, extra.db), then it upgrades its system dependencies, then it syncs the file in question. "-S" being a core operation has to be first, while y and u are subcommands/options. 
* Once the system has found the package, what it has actually found is an executable file. This is a binary distilled by a compiler from what may once have been human readable code into more efficient, machine readable instructions.

### Key Commands Summary
| Command | What it does |
| :--- | :--- |
| `-S` | Sync (Install) |
| `-y` | Refresh databases |
| `-u` | System upgrade |

> **Technical Note:** On Arch, "Partial Upgrades" are unsupported. Always sync (`y`) and upgrade (`u`) together to maintain system integrity.

## Appendix
### The error
'''
sudo pacman -S hugo
resolving dependencies...
looking for conflicting packages...
Package (1)  New Version  Net Change  Download Size
extra/hugo   0.154.2-1     84.87 MiB      20.32 MiB
Total Download Size:   20.32 MiB
Total Installed Size:  84.87 MiB

:: Proceed with installation? [Y/n] Y

:: Retrieving packages...

 hugo-0.154.2-1-x86_64.pkg.tar.zst failed to download

error: failed retrieving file 'hugo-0.154.2-1-x86_64.pkg.tar.zst' from stable-mirror.omarchy.org : The requested URL returned error: 404

warning: failed to retrieve some files

error: failed to commit transaction (failed to retrieve some files)

Errors occurred, no packages were upgraded.
'''