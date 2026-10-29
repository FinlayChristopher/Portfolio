# Multiplayer framework

The networking and threading side of a multiplayer game, built in C# using MonoGame.

![Multiplayer Game - MonoGame](MultiClientCMD.mp4 "The server console on the left, client windows on the right. Each client that logs in is handled by its own thread on the server.")

> **Built with:** C#, MonoGame
> **Status:** In progress, scoped to 30 November 2026
> **So far:** Client-server connection, one thread per connected client, a menu screen
> **Next:** Replication

## Problems I solved

### A server that serves more than one player

**Problem:** The first server accepted one connection and then sat reading from it. Reading blocks until data arrives, so it never got back to accepting a second player.

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

**Why it's built this way**

The accept loop adds to `m_Clients` while every client's thread reads from it. An ordinary `Dictionary` isn't safe to write and read from different threads at once, and can corrupt itself, so I used a `ConcurrentDictionary`, where each add and each read is safe on its own.

`socket` and `id` are declared inside the loop, so each thread's lambda captures its own copy. Declared outside the loop, every thread would share one variable that the next connection overwrites, and two clients could end up talking through the same socket.

Only this loop increments `m_NextClientId`, so `Interlocked.Increment` is a safeguard rather than the fix for a race I actually hit.

**Not yet tested** more than one client connected and functioning with replication.

[Source is on GitHub and will be public when the project ends](https://github.com/FinlayChristopher/Multiplayer-Games-Programming)
