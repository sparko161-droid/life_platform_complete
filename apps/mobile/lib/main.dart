import 'package:flutter/material.dart';

void main() => runApp(const LifeApp());

class LifeApp extends StatelessWidget {
  const LifeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Жизнь',
      theme: ThemeData(useMaterial3: true),
      home: const Scaffold(
        body: Center(child: Text('Life Mobile — bootstrap')),
      ),
    );
  }
}
