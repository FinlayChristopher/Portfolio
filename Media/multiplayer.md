<!-- The multiplayer page. Same rules as renderer.md (see the top of that file). -->

# Multiplayer framework

The networking and threading side of a multiplayer game, built in C# on MonoGame.

![Multiplayer Game - MonoGame](MultiClientCMD.mp4 "The server console on the left, client windows on the right. Each client that logs in is handled by its own thread on the server.")

> **Built with:** C#, MonoGame
> **Status:** In progress, scoped to 30 November 2026
> **So far:** Client-server connection, one thread per connected client, a menu screen

## Problems I solved

### A server that serves more than one player

**Problem:** the first server accepted one connection and then sat reading from it. Reading blocks until data arrives, so it never got back to accepting a second player.

**What I did:** the server now keeps accepting, and hands each new connection to its own thread with a unique ID, stored in a thread-safe dictionary. One slow client can't hold up the others.

```csharp
public void Start()
{
    m_TcpListener.Start();
    Console.WriteLine("Server Started....");
    while (true)
    {
        Socket socket = m_TcpListener.AcceptSocket();
        int id = Interlocked.Increment(ref m_NextClientId);
        m_Clients.TryAdd(id, new ConnectedUser(socket, id));
        Console.WriteLine("Client " + id + " connected");

        Thread thread = new Thread(() => ClientMethod(socket, id));
        thread.Start();
    }
}
```

<!-- YOUR WORDS: the shared state. The accept loop adds to m_Clients while every client
     thread reads from it, and an ordinary Dictionary can corrupt itself when written and read
     from different threads at once; ConcurrentDictionary makes each add and read safe.
     socket and id are declared inside the loop, so each thread's lambda captures its own copy
     rather than one variable that the next connection overwrites (the capture trap).
     Check before you claim it: only this one loop increments m_NextClientId, so Interlocked
     is a safeguard here rather than a fix for a race you hit. And the last commit is
     "UNTESTED", so test with several clients before the page says it works. -->

<!-- REPO LINK: the repo is private for now. When it's public, add [Source on GitHub](link) here. -->
